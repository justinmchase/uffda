import { basename, dirname, fromFileUrl, join, toFileUrl } from "@std/path";
import {
  type CompletionItem,
  CompletionItemKind,
  type Range,
} from "vscode-languageserver-types";
import { compileUffdaSource } from "../lang/uffda/execute.ts";
import { MatchKind } from "../match.ts";
import { ExportDeclarationKind } from "../runtime/declarations/export.ts";
import { offsetToPosition } from "./lsp.positions.ts";
import type { RuntimeSession } from "./mcp.session.ts";

/**
 * Position-aware completion inside `.uff` import declarations
 * (`import "<specifier>" Name…;`, requirement 006): file paths while the cursor
 * is inside the module specifier string, and the imported module's exports
 * while it is in the name list.
 *
 * The context is classified lexically from the cursor's line rather than
 * from the parse tree: completion is requested mid-edit, when the declaration
 * is usually incomplete (an unterminated string swallows the rest of the
 * document), so the retained parse tree cannot be trusted to locate it.
 */

export enum ImportCompletionContextKind {
  Specifier = "specifier",
  Names = "names",
}

export type ImportCompletionContext =
  | {
    kind: ImportCompletionContextKind.Specifier;
    /** Specifier text typed so far (between the opening quote and cursor). */
    typed: string;
    /** Range of the path segment being completed (after the last `/`). */
    replace: { start: number; end: number };
  }
  | {
    kind: ImportCompletionContextKind.Names;
    specifier: string;
    /** Names already listed before the one being typed. */
    listed: string[];
    /** Range of the identifier being typed (possibly empty). */
    replace: { start: number; end: number };
  };

const SPECIFIER_PREFIX = /^\s*import\s+"([^"]*)$/;
const NAMES_PREFIX =
  /^\s*import\s+"([^"]*)"((?:\s+[A-Za-z_][A-Za-z0-9_]*)*)\s+([A-Za-z_][A-Za-z0-9_]*)?$/;

/** Classifies `offset` in `source` as an import-completion position, if any. */
export function importCompletionContext(
  source: string,
  offset: number,
): ImportCompletionContext | undefined {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const prefix = source.slice(lineStart, offset);

  const specifier = SPECIFIER_PREFIX.exec(prefix);
  if (specifier) {
    const typed = specifier[1];
    const start = offset - (typed.length - (typed.lastIndexOf("/") + 1));
    let end = offset;
    while (end < source.length && !/["/\s]/.test(source[end])) end++;
    return {
      kind: ImportCompletionContextKind.Specifier,
      typed,
      replace: { start, end },
    };
  }

  const names = NAMES_PREFIX.exec(prefix);
  if (names) {
    const partial = names[3] ?? "";
    let end = offset;
    while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end++;
    return {
      kind: ImportCompletionContextKind.Names,
      specifier: names[1],
      listed: names[2].split(/\s+/).filter((n) => n.length > 0),
      replace: { start: offset - partial.length, end },
    };
  }

  return undefined;
}

function rangeOf(source: string, span: { start: number; end: number }): Range {
  return {
    start: offsetToPosition(source, span.start),
    end: offsetToPosition(source, span.end),
  };
}

/**
 * Directories and `.uff` modules reachable from the specifier typed so far,
 * resolved against the importing document's directory. Only relative
 * specifiers (`./`, `../`) are completed; the document itself is excluded.
 */
export async function specifierCompletionItems(
  documentPath: string,
  source: string,
  context: Extract<
    ImportCompletionContext,
    { kind: ImportCompletionContextKind.Specifier }
  >,
): Promise<CompletionItem[]> {
  const { typed } = context;
  const range = rangeOf(source, context.replace);
  if (typed === "" || typed === ".") {
    return ["./", "../"].map((label) => ({
      label,
      kind: CompletionItemKind.Folder,
      textEdit: { range, newText: label },
      command: RETRIGGER,
    }));
  }
  if (!typed.startsWith("./") && !typed.startsWith("../")) return [];

  const directoryPart = typed.slice(0, typed.lastIndexOf("/") + 1);
  const directory = join(dirname(documentPath), directoryPart);
  const self = basename(documentPath);
  const items: CompletionItem[] = [];
  try {
    for await (const entry of Deno.readDir(directory)) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory) {
        items.push({
          label: `${entry.name}/`,
          kind: CompletionItemKind.Folder,
          textEdit: { range, newText: `${entry.name}/` },
          command: RETRIGGER,
        });
      } else if (
        entry.isFile && entry.name.endsWith(".uff") &&
        !(directoryPart === "./" && entry.name === self)
      ) {
        items.push({
          label: entry.name,
          kind: CompletionItemKind.File,
          textEdit: { range, newText: entry.name },
        });
      }
    }
  } catch {
    return [];
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

/** Re-opens the suggestion list after accepting a directory segment. */
const RETRIGGER = {
  title: "Suggest",
  command: "editor.action.triggerSuggest",
};

type ExportedName = { name: string; detail: string };

/**
 * The exports of the module `context.specifier` names (relative to the
 * importing document), minus names already listed. Prefers the session's
 * resolved module; otherwise compiles the module's source read-only (no
 * artifact is written).
 */
export async function nameCompletionItems(
  session: RuntimeSession,
  documentPath: string,
  source: string,
  context: Extract<
    ImportCompletionContext,
    { kind: ImportCompletionContextKind.Names }
  >,
): Promise<CompletionItem[]> {
  let moduleUrl: URL;
  try {
    moduleUrl = new URL(context.specifier, toFileUrl(documentPath));
  } catch {
    return [];
  }
  const exported = await exportedNames(session, moduleUrl);
  const range = rangeOf(source, context.replace);
  const listed = new Set(context.listed);
  return exported
    .filter(({ name }) => !listed.has(name))
    .map(({ name, detail }) => ({
      label: name,
      kind: CompletionItemKind.Reference,
      detail,
      textEdit: { range, newText: name },
    }));
}

async function exportedNames(
  session: RuntimeSession,
  moduleUrl: URL,
): Promise<ExportedName[]> {
  const resolved = session.listDeclarations(moduleUrl.href);
  if (resolved && resolved.moduleUrl === moduleUrl.href) {
    return resolved.declarations
      .filter((d) => d.exported)
      .map((d) => ({ name: d.name, detail: `exported ${d.kind}` }));
  }

  if (moduleUrl.protocol !== "file:" || !moduleUrl.pathname.endsWith(".uff")) {
    return [];
  }
  let text: string;
  try {
    text = await Deno.readTextFile(fromFileUrl(moduleUrl));
  } catch {
    return [];
  }
  const compiled = await compileUffdaSource(text);
  if (compiled.kind !== MatchKind.Ok) return [];
  return compiled.value.exports.map((e) => ({
    name: e.name,
    detail: e.kind === ExportDeclarationKind.Import
      ? "re-exported import"
      : `exported ${e.kind}`,
  }));
}
