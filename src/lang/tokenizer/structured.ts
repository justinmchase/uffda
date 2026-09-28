import type { Match, MatchOk } from "../../match.ts";
import { MatchKind } from "../../match.ts";
import type { ItemSourceSpan, SourceSpan } from "../../span.ts";
import { rawOf } from "../../wrapped.ts";

export enum StructuredTokenKind {
  Whitespace = "whitespace",
  NewLine = "newline",
  Word = "word",
  Punctuation = "punctuation",
  Comment = "comment",
}

/** Lexer AST: kind and text only. Source spans live on Match, not on values. */
export type TokenValue = {
  kind: StructuredTokenKind;
  text: string;
};

export function isTokenValue(value: unknown): value is TokenValue {
  if (value == null || typeof value !== "object") return false;
  const token = value as Partial<TokenValue>;
  return Object.values(StructuredTokenKind).includes(
    token.kind as StructuredTokenKind,
  ) &&
    typeof token.text === "string" &&
    !("normalizedSpan" in token) &&
    !("originalSpan" in token);
}

export function isTriviaToken(token: TokenValue): boolean {
  return token.kind === StructuredTokenKind.Whitespace ||
    token.kind === StructuredTokenKind.Comment;
}

export function isSemanticNoWhitespaceToken(token: TokenValue): boolean {
  return token.kind === StructuredTokenKind.Word ||
    token.kind === StructuredTokenKind.Punctuation;
}

/** A token read from a match value, whose properties are wrapped. */
function tokenOf(value: unknown): TokenValue | undefined {
  const raw = rawOf(value);
  if (raw == null || typeof raw !== "object") return undefined;
  const { kind, text } = raw as Record<string, unknown>;
  const token = { kind: rawOf(kind), text: rawOf(text) };
  return isTokenValue(token) ? token : undefined;
}

type SpannedToken = TokenValue & {
  normalizedSpan: SourceSpan;
  originalSpan: SourceSpan;
};

/**
 * Pre-order walk collecting the innermost token-valued Ok matches. Runs
 * during pipeline evaluation over arbitrarily deep Match graphs, so it uses
 * an explicit stack instead of host recursion (see the rule boundary in
 * `.agents/specifications/runtime.spec.md`).
 */
function collectSpannedTokens(node: Match): SpannedToken[] {
  const tokens: SpannedToken[] = [];
  const pending: Match[] = [node];
  const pushChildren = (children: Match[]) => {
    for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
  };

  while (pending.length > 0) {
    const match = pending.pop()!;
    if (match.kind === MatchKind.Ok) {
      const token = tokenOf(match.value);
      if (token) {
        const inner = match.matches[0];
        if (inner?.kind === MatchKind.Ok && tokenOf(inner.value)) {
          pending.push(inner);
          continue;
        }
        tokens.push({
          ...token,
          normalizedSpan: { ...match.normalizedSpan },
          originalSpan: { ...match.originalSpan },
        });
        continue;
      }
      pushChildren(match.matches);
    } else if (match.kind === MatchKind.Fail) {
      pushChildren(match.matches);
    }
  }
  return tokens;
}

/** Character spans for TokenizerNoWhitespace semantic tokens, in stream order. */
export function itemSpansFromTokenizerMatch(
  match: MatchOk,
): ItemSourceSpan[] {
  return collectSpannedTokens(match)
    .filter(isSemanticNoWhitespaceToken)
    .map((token) => ({
      normalized: token.normalizedSpan,
      original: token.originalSpan,
    }));
}
