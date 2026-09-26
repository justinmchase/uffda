import { fromFileUrl, toFileUrl } from "@std/path";
import type { Location, Range } from "vscode-languageserver-types";
import type { Match } from "../match.ts";
import { CliLanguage } from "./contract.ts";
import {
  declaredName,
  EditorDecorator,
  findAnnotated,
} from "./editor_metadata.ts";
import { identifierAtOffset } from "./lsp.hover.ts";
import { offsetToPosition, positionToOffset } from "./lsp.positions.ts";
import type { RuntimeSession } from "./mcp.session.ts";
import { parseSourceToAst } from "./stream.ts";

/**
 * LSP go-to-definition for `.uff` documents (requirement 006): resolve the
 * identifier under the cursor against the session's module graph, then locate
 * its declaring production in a parse `Match` tree. Never invents a location
 * when the declaration span cannot be proven.
 */

export type DeclarationSpan = {
  start: number;
  end: number;
};

/**
 * Walks a parse `Match` for a `[Declaration]` production whose projected
 * `name` equals `name`, returning its `originalSpan`. Walks Ok and Fail
 * children so a declaration matched before a later failure is still findable.
 */
export function declarationSpanInMatch(
  match: Match,
  name: string,
): DeclarationSpan | undefined {
  const found = findAnnotated(
    match,
    EditorDecorator.Declaration,
    (node) =>
      declaredName(node) === name &&
      node.originalSpan.end > node.originalSpan.start,
  );
  return found && {
    start: found.originalSpan.start,
    end: found.originalSpan.end,
  };
}

function rangeFromSpan(source: string, span: DeclarationSpan): Range {
  return {
    start: offsetToPosition(source, span.start),
    end: offsetToPosition(source, span.end),
  };
}

function isUffFileUrl(href: string): boolean {
  if (!href.startsWith("file:")) return false;
  try {
    return fromFileUrl(href).endsWith(".uff");
  } catch {
    return false;
  }
}

export type DefinitionSourceLookup = {
  /**
   * Prefer an already-open document's parse state for `definingModuleUrl`
   * (unsaved buffer) over reading disk.
   */
  openDocumentSource?: (
    definingModuleUrl: string,
  ) => { source: string; match: Match } | undefined;
};

/**
 * Builds LSP `Location[]` for the declaration under `position`. Returns an
 * empty array when nothing resolvable is under the cursor or the declaring
 * span cannot be located — never guesses.
 */
export async function definitionAtPosition(
  session: RuntimeSession,
  source: string,
  position: { line: number; character: number },
  match: Match | undefined,
  lookup: DefinitionSourceLookup = {},
): Promise<Location[]> {
  const offset = positionToOffset(source, position);
  const ident = identifierAtOffset(source, offset, match);
  if (!ident) return [];

  const resolved = session.resolveDeclaration(ident.name);
  if (!resolved.ok) return [];

  const { definingModuleUrl } = resolved.declaration;
  if (!isUffFileUrl(definingModuleUrl)) return [];

  const located = await locateDeclarationSource(
    session,
    definingModuleUrl,
    ident.name,
    lookup,
  );
  if (!located) return [];

  return [{
    uri: definingModuleUrl,
    range: rangeFromSpan(located.source, located.span),
  }];
}

async function locateDeclarationSource(
  session: RuntimeSession,
  definingModuleUrl: string,
  name: string,
  lookup: DefinitionSourceLookup,
): Promise<{ source: string; span: DeclarationSpan } | undefined> {
  const fromOpen = lookup.openDocumentSource?.(definingModuleUrl);
  if (fromOpen) {
    const span = declarationSpanInMatch(fromOpen.match, name);
    if (span) return { source: fromOpen.source, span };
  }

  const fromSession = session.getParseState(definingModuleUrl);
  if (fromSession) {
    const span = declarationSpanInMatch(fromSession.match, name);
    if (span) return { source: fromSession.source, span };
  }

  // Read-only re-parse of the defining `.uff` on disk. Does not mutate the
  // session's module graph or parse-state map.
  let path: string;
  try {
    path = fromFileUrl(definingModuleUrl);
  } catch {
    return undefined;
  }

  let diskSource: string;
  try {
    diskSource = await Deno.readTextFile(path);
  } catch {
    return undefined;
  }

  const parsed = await parseSourceToAst(
    diskSource,
    CliLanguage.FullUffda,
    path,
  );
  const span = declarationSpanInMatch(parsed.match, name);
  if (!span) return undefined;
  return { source: diskSource, span };
}

/** Convenience: file path → `file:` URL for tests and callers. */
export function fileUrlForPath(path: string): string {
  return toFileUrl(path).href;
}
