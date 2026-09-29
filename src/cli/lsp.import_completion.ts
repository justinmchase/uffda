import { basename, dirname, fromFileUrl, join, toFileUrl } from "@std/path";
import {
  type CompletionItem,
  CompletionItemKind,
  type Range,
} from "vscode-languageserver-types";
import { compileUffdaSource } from "../lang/uffda/execute.ts";
import { isClean } from "../match.ts";
import { ExportDeclarationKind } from "../runtime/declarations/export.ts";
import type {
  CompletionContext,
  CompletionContextKind,
  CompletionReplace,
} from "./lsp.completion_context.ts";
import { offsetToPosition } from "./lsp.positions.ts";
import type { RuntimeSession } from "./mcp.session.ts";
import { valueOf } from "../match.ts";

/**
 * Completion items for import contexts (requirement 006): module files while
 * the cursor is in a `[ModulePath]`, and the imported module's exports while
 * it is in an `[ImportedName]` (see `lsp.completion_context.ts` for how those
 * contexts are derived from the document's own grammar).
 */

type ModulePathContext = Extract<
  CompletionContext,
  { kind: CompletionContextKind.ModulePath }
>;

type ImportedNameContext = Extract<
  CompletionContext,
  { kind: CompletionContextKind.ImportedName }
>;

export function rangeOf(source: string, span: CompletionReplace): Range {
  return {
    start: offsetToPosition(source, span.start),
    end: offsetToPosition(source, span.end),
  };
}

/**
 * Directories and modules (files with one of `context.extensions`, or any
 * file when unrestricted) reachable from the path typed so far, resolved
 * against the importing document's directory. Only relative paths (`./`,
 * `../`) are completed; the document itself is excluded.
 */
export async function specifierCompletionItems(
  documentPath: string,
  source: string,
  context: ModulePathContext,
): Promise<CompletionItem[]> {
  const { typed, extensions } = context;
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
        entry.isFile &&
        (extensions === undefined ||
          extensions.some((ext) => entry.name.endsWith(ext))) &&
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
 * The exports of the module `context.modulePath` names (relative to the
 * importing document), minus names already listed. Prefers the session's
 * resolved module; otherwise compiles the module's source read-only (no
 * artifact is written).
 */
export async function nameCompletionItems(
  session: RuntimeSession,
  documentPath: string,
  source: string,
  context: ImportedNameContext,
): Promise<CompletionItem[]> {
  if (context.modulePath === undefined) return [];
  let moduleUrl: URL;
  try {
    moduleUrl = new URL(context.modulePath, toFileUrl(documentPath));
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

  if (moduleUrl.protocol !== "file:") return [];
  let text: string;
  try {
    text = await Deno.readTextFile(fromFileUrl(moduleUrl));
  } catch {
    return [];
  }
  const compiled = await compileUffdaSource(text);
  if (!isClean(compiled)) return [];
  return valueOf(compiled).exports.map((e) => ({
    name: e.name,
    detail: e.kind === ExportDeclarationKind.Import
      ? "re-exported import"
      : `exported ${e.kind}`,
  }));
}
