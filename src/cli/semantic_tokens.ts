import type {
  SemanticTokens,
  SemanticTokensLegend,
} from "vscode-languageserver-types";
import { SemanticTokensBuilder } from "vscode-languageserver/node";
import { HighlightRole, type HighlightSpan } from "./highlight.ts";

/**
 * Maps `highlight.ts`'s `HighlightRole` (already derived from the grammar's
 * own parse tree — tokenizer rule names plus `[Keyword]` decorator metadata
 * today; see that module's docs and the `[Token]` follow-up in GitHub issue
 * #159) onto the LSP semantic-tokens legend
 * (`.agents/requirements/cli-language-server/005-syntax-highlighting.requirement.md`).
 * Standard `SemanticTokenTypes` names are reused verbatim so editors that
 * ship built-in color rules for them (most do) render something reasonable
 * with no extension-side theme contribution required.
 *
 * `Whitespace`/`NewLine` intentionally have no entry: per the requirement,
 * a rule with no meaningful classification MUST NOT itself emit a semantic
 * token, and highlighting insignificant trivia would only add noise.
 */
const ROLE_TOKEN_TYPE: ReadonlyMap<HighlightRole, string> = new Map([
  [HighlightRole.Keyword, "keyword"],
  [HighlightRole.Identifier, "variable"],
  [HighlightRole.String, "string"],
  [HighlightRole.Comment, "comment"],
  [HighlightRole.Punctuation, "operator"],
]);

const TOKEN_TYPES = [...new Set(ROLE_TOKEN_TYPE.values())];
const TOKEN_TYPE_INDEX: ReadonlyMap<string, number> = new Map(
  TOKEN_TYPES.map((type, index) => [type, index]),
);

/** The legend the server MUST declare in `initialize`'s
 * `semanticTokensProvider.legend`, matching the indices `buildSemanticTokens`
 * pushes tokens against. */
export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: TOKEN_TYPES,
  tokenModifiers: [],
};

function computeLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

/** Largest index `i` such that `lineStarts[i] <= offset` (binary search). */
function lineIndexForOffset(offset: number, lineStarts: number[]): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Pushes `span` into `builder`, split at any embedded newline. In practice
 * no non-trivia `HighlightSpan` ever contains `"\n"` — every tokenizer rule
 * that can (`WhitespaceToken`'s siblings, `NewLineToken` itself) is either
 * excluded from `ROLE_TOKEN_TYPE` or matches at most a single line — but
 * splitting defensively here keeps this correct even if that ever changes,
 * rather than silently corrupting/dropping a multi-line span.
 */
function pushSpan(
  builder: SemanticTokensBuilder,
  span: HighlightSpan,
  tokenType: number,
  sourceText: string,
  lineStarts: number[],
): void {
  let segmentStart = span.offset;
  const end = span.offset + span.length;
  while (segmentStart < end) {
    const line = lineIndexForOffset(segmentStart, lineStarts);
    const nextLineStart = line + 1 < lineStarts.length
      ? lineStarts[line + 1]
      : undefined;
    const lineEnd = nextLineStart !== undefined
      ? Math.min(end, nextLineStart - 1)
      : end;
    const length = lineEnd - segmentStart;
    if (length > 0) {
      builder.push(
        line,
        segmentStart - lineStarts[line],
        length,
        tokenType,
        0,
      );
    }
    segmentStart = lineEnd < end && sourceText[lineEnd] === "\n"
      ? lineEnd + 1
      : lineEnd;
    if (length === 0 && segmentStart <= lineEnd) break; // safety valve
  }
}

/**
 * Projects `spans` (see `highlight.ts`) into an LSP `SemanticTokens`
 * response against `sourceText`, using `SEMANTIC_TOKENS_LEGEND`'s token
 * type indices. `SemanticTokensBuilder` (from `vscode-languageserver`)
 * handles the line/character delta-encoding `SemanticTokens.data` requires.
 */
export function buildSemanticTokens(
  spans: readonly HighlightSpan[],
  sourceText: string,
): SemanticTokens {
  const builder = new SemanticTokensBuilder();
  const lineStarts = computeLineStarts(sourceText);
  for (const span of spans) {
    const type = ROLE_TOKEN_TYPE.get(span.role);
    if (type === undefined) continue;
    const tokenType = TOKEN_TYPE_INDEX.get(type)!;
    pushSpan(builder, span, tokenType, sourceText, lineStarts);
  }
  return builder.build();
}
