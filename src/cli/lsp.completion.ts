import {
  type CompletionItem,
  CompletionItemKind,
  type Range,
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
 * `RuntimeSession.listDeclarations()`. Read-only over resolved state. Offered
 * only where the grammar marks a `[NameReference]` (see
 * `lsp.completion_context.ts`), restricted to the kinds it names.
 */

const COMPLETION_KINDS: Record<LoadedDeclarationKind, CompletionItemKind> = {
  rule: CompletionItemKind.Function,
  func: CompletionItemKind.Method,
  decorator: CompletionItemKind.Property,
};

export type DeclarationCompletionOptions = {
  /** Declaration kinds to offer (`undefined`: every kind). */
  kinds?: readonly string[];
  /** Range each item replaces (the name typed so far). */
  range?: Range;
};

/** Maps a module's in-scope declarations to LSP completion items. */
export function completionItemsForModule(
  summary: LoadedModuleSummary,
  options: DeclarationCompletionOptions = {},
): CompletionItem[] {
  const { kinds, range } = options;
  const seen = new Set<string>();
  const items: CompletionItem[] = [];
  for (const declaration of summary.declarations) {
    if (kinds && !kinds.includes(declaration.kind)) continue;
    const key = `${declaration.kind}:${declaration.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      label: declaration.name,
      kind: COMPLETION_KINDS[declaration.kind],
      detail: declaration.exported
        ? `exported ${declaration.kind}`
        : declaration.kind,
      ...(range ? { textEdit: { range, newText: declaration.name } } : {}),
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
  options: DeclarationCompletionOptions = {},
): CompletionItem[] {
  const summary = session.listDeclarations();
  return summary ? completionItemsForModule(summary, options) : [];
}
