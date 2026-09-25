import {
  type CompletionItem,
  CompletionItemKind,
} from "vscode-languageserver-types";
import type {
  LoadedDeclarationKind,
  LoadedModuleSummary,
  RuntimeSession,
} from "./mcp.session.ts";

/**
 * LSP completion for `.uff` documents (requirement 006): offers the
 * rule/func/decorator names in scope for the document's resolved module —
 * its own declarations plus names bound by its imports — as reported by
 * `RuntimeSession.listDeclarations()`. Read-only over resolved state.
 */

const COMPLETION_KINDS: Record<LoadedDeclarationKind, CompletionItemKind> = {
  rule: CompletionItemKind.Function,
  func: CompletionItemKind.Method,
  decorator: CompletionItemKind.Property,
};

/** Maps a module's in-scope declarations to LSP completion items. */
export function completionItemsForModule(
  summary: LoadedModuleSummary,
): CompletionItem[] {
  const seen = new Set<string>();
  const items: CompletionItem[] = [];
  for (const declaration of summary.declarations) {
    const key = `${declaration.kind}:${declaration.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      label: declaration.name,
      kind: COMPLETION_KINDS[declaration.kind],
      detail: declaration.exported
        ? `exported ${declaration.kind}`
        : declaration.kind,
    });
  }
  return items;
}

/**
 * Builds completion items for the session's most recently loaded root
 * module. Returns an empty list when nothing has resolved yet (for example a
 * document whose first parse failed) rather than erroring.
 */
export function completionItemsForSession(
  session: RuntimeSession,
): CompletionItem[] {
  const summary = session.listDeclarations();
  return summary ? completionItemsForModule(summary) : [];
}
