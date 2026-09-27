import { walk } from "@std/fs";
import { toFileUrl } from "@std/path";
import type {
  Location,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver-types";
import { type Match, MatchKind } from "../match.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { highlightSpansFromMatch, isNameRole } from "./highlight.ts";
import { offsetToPosition } from "./lsp.positions.ts";
import {
  type NameOccurrence,
  nameOccurrences,
  type NameSymbol,
  NameSymbolKind,
  sameSymbol,
} from "./lsp.symbols.ts";

/**
 * LSP find-references and rename (requirement 006): the occurrences of the
 * symbol under the cursor across the workspace, found per document by
 * `nameOccurrences`. A local binding's occurrences are all in its document;
 * a declaration's are in its module and the modules importing it (exports
 * name only a module's own declarations, so nothing re-exports it); a
 * runtime global's are wherever it is referenced.
 */

/** A parsed `.uff` document: an open buffer or a file on disk. */
export type SymbolDocument = {
  /** The URI to report locations and edits against. */
  uri: string;
  /** The module URL its imports resolve against. */
  moduleUrl: string;
  source: string;
  match: Match;
};

export type WorkspaceDocuments = {
  /** The open documents, whose buffers win over their files on disk. */
  open: readonly SymbolDocument[];
  /** Directory whose `.uff` files (recursively) make up the workspace. */
  root: string;
};

export type DocumentOccurrences = {
  document: SymbolDocument;
  occurrences: NameOccurrence[];
};

/** The occurrence at `offset` in `document`, if a name there denotes one. */
export function occurrenceAt(
  document: SymbolDocument,
  offset: number,
  globals: ReadonlySet<string>,
): NameOccurrence | undefined {
  return nameOccurrences(
    document.moduleUrl,
    document.source,
    document.match,
    globals,
  ).find((occurrence) =>
    offset >= occurrence.start && offset <= occurrence.end
  );
}

const SKIPPED_DIRECTORIES = [/[\\/](node_modules|\.git)([\\/]|$)/];

/**
 * Whether a document's text could mention `symbol`: it contains the name
 * and, for a declaration, is its module or contains the module's file name
 * (every import path resolving to that module ends with it).
 */
function mayMention(
  symbol: NameSymbol,
  name: string,
  moduleUrl: string,
  source: string,
): boolean {
  if (!source.includes(name)) return false;
  if (symbol.kind !== NameSymbolKind.Declaration) return true;
  if (moduleUrl === symbol.moduleUrl) return true;
  const fileName = symbol.moduleUrl.slice(
    symbol.moduleUrl.lastIndexOf("/") + 1,
  );
  let decoded = fileName;
  try {
    decoded = decodeURIComponent(fileName);
  } catch {
    // An undecodable name can only appear encoded.
  }
  return source.includes(fileName) || source.includes(decoded);
}

/**
 * The workspace documents that may mention `symbol` (see `mayMention`):
 * open documents, then `.uff` files under `root` not open, each parsed
 * read-only.
 */
async function* documentsMentioning(
  workspace: WorkspaceDocuments,
  symbol: NameSymbol,
  name: string,
): AsyncGenerator<SymbolDocument> {
  const open = new Set(workspace.open.map((document) => document.moduleUrl));
  for (const document of workspace.open) {
    if (mayMention(symbol, name, document.moduleUrl, document.source)) {
      yield document;
    }
  }
  let entries;
  try {
    entries = walk(workspace.root, {
      includeDirs: false,
      exts: [".uff"],
      skip: SKIPPED_DIRECTORIES,
    });
    for await (const entry of entries) {
      const moduleUrl = toFileUrl(entry.path).href;
      if (open.has(moduleUrl)) continue;
      let source: string;
      try {
        source = await Deno.readTextFile(entry.path);
      } catch {
        continue;
      }
      if (!mayMention(symbol, name, moduleUrl, source)) continue;
      yield {
        uri: moduleUrl,
        moduleUrl,
        source,
        match: await uffdaGrammar(source),
      };
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

/**
 * Every occurrence of `symbol` (spelled `name`), grouped by document:
 * `origin` alone for a local binding, otherwise every workspace document.
 */
export async function symbolOccurrences(
  symbol: NameSymbol,
  name: string,
  origin: SymbolDocument,
  workspace: WorkspaceDocuments,
  globals: ReadonlySet<string>,
): Promise<DocumentOccurrences[]> {
  const inDocument = (document: SymbolDocument) =>
    nameOccurrences(
      document.moduleUrl,
      document.source,
      document.match,
      globals,
      name,
    ).filter((occurrence) => sameSymbol(occurrence.symbol, symbol));

  if (symbol.kind === NameSymbolKind.Local) {
    return [{ document: origin, occurrences: inDocument(origin) }];
  }
  const found: DocumentOccurrences[] = [];
  for await (const document of documentsMentioning(workspace, symbol, name)) {
    const occurrences = inDocument(document);
    if (occurrences.length > 0) found.push({ document, occurrences });
  }
  return found;
}

/** LSP locations for `found`, optionally without declaring occurrences. */
export function referenceLocations(
  found: readonly DocumentOccurrences[],
  includeDeclaration: boolean,
): Location[] {
  return found.flatMap(({ document, occurrences }) =>
    occurrences
      .filter((occurrence) => includeDeclaration || !occurrence.declaration)
      .map((occurrence) => ({
        uri: document.uri,
        range: {
          start: offsetToPosition(document.source, occurrence.start),
          end: offsetToPosition(document.source, occurrence.end),
        },
      }))
  );
}

export type RenamePlan =
  | { ok: true; edit: WorkspaceEdit }
  | { ok: false; message: string };

/** Why `symbol` cannot be renamed at all, if it cannot. */
export function renameRefusal(symbol: NameSymbol): string | undefined {
  return symbol.kind === NameSymbolKind.Global
    ? `\`${symbol.name}\` is a runtime global and cannot be renamed`
    : undefined;
}

/**
 * The workspace edit renaming every occurrence in `found` of `symbol` to
 * `newName`. Refused when the symbol is a runtime global, when its declaring
 * module is not in the workspace, when `newName` already names something in a
 * document the rename edits (so no reference changes what it denotes), or
 * when the grammar does not read `newName` back as that same name at every
 * edited occurrence (for example a reserved word, or not a name at all).
 */
export async function planRename(
  symbol: NameSymbol,
  found: readonly DocumentOccurrences[],
  newName: string,
  globals: ReadonlySet<string>,
): Promise<RenamePlan> {
  const refusal = renameRefusal(symbol);
  if (refusal) return { ok: false, message: refusal };
  if (
    symbol.kind === NameSymbolKind.Declaration &&
    !found.some(({ occurrences }) => occurrences.some((o) => o.declaration))
  ) {
    return {
      ok: false,
      message:
        `\`${symbol.name}\` is declared in ${symbol.moduleUrl}, outside the workspace`,
    };
  }

  const changes: Record<string, TextEdit[]> = {};
  for (const { document, occurrences } of found) {
    const conflict = nameOccurrences(
      document.moduleUrl,
      document.source,
      document.match,
      globals,
      newName,
    );
    if (conflict.length > 0) {
      return {
        ok: false,
        message: `\`${newName}\` already names something in ${document.uri}`,
      };
    }

    const sorted = [...occurrences].sort((a, b) => a.start - b.start);
    let renamed = "";
    let cursor = 0;
    const renamedSpans: { start: number; end: number }[] = [];
    for (const occurrence of sorted) {
      renamed += document.source.slice(cursor, occurrence.start);
      renamedSpans.push({
        start: renamed.length,
        end: renamed.length + newName.length,
      });
      renamed += newName;
      cursor = occurrence.end;
    }
    renamed += document.source.slice(cursor);
    if (!(await readsBackAsName(document, renamed, renamedSpans, newName))) {
      return {
        ok: false,
        message: `\`${newName}\` is not a valid name here`,
      };
    }

    changes[document.uri] = sorted.map((occurrence) => ({
      range: {
        start: offsetToPosition(document.source, occurrence.start),
        end: offsetToPosition(document.source, occurrence.end),
      },
      newText: newName,
    }));
  }
  return { ok: true, edit: { changes } };
}

/**
 * Whether `renamed` parses (at least as well as `document` did) with a name
 * token spelled `newName` at each of `spans`.
 */
async function readsBackAsName(
  document: SymbolDocument,
  renamed: string,
  spans: readonly { start: number; end: number }[],
  newName: string,
): Promise<boolean> {
  const match = await uffdaGrammar(renamed);
  if (document.match.kind === MatchKind.Ok && match.kind !== MatchKind.Ok) {
    return false;
  }
  const names = new Set(
    highlightSpansFromMatch(match, renamed)
      .filter((span) => isNameRole(span.role) && span.text === newName)
      .map((span) => span.offset),
  );
  return spans.every((span) => names.has(span.start));
}
