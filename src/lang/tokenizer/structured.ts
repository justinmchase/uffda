import type { Match, MatchOk } from "../../match.ts";
import { MatchKind } from "../../match.ts";
import type { ItemSourceSpan, SourceSpan } from "../../span.ts";
import {
  semantic_no_whitespace_texts,
  semantic_texts,
} from "../../runtime/std/semantic_texts.ts";

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

/** @deprecated Prefer std `semantic_texts`. */
export function toSemanticTexts(tokens: TokenValue[]): string[] {
  return semantic_texts(tokens);
}

/** @deprecated Prefer std `semantic_no_whitespace_texts`. */
export function toSemanticNoWhitespaceTexts(tokens: TokenValue[]): string[] {
  return semantic_no_whitespace_texts(tokens);
}

type SpannedToken = TokenValue & {
  normalizedSpan: SourceSpan;
  originalSpan: SourceSpan;
};

function collectSpannedTokens(node: Match): SpannedToken[] {
  const tokens: SpannedToken[] = [];

  function visit(match: Match): void {
    if (match.kind === MatchKind.Ok) {
      if (isTokenValue(match.value)) {
        const inner = match.matches[0];
        if (inner?.kind === MatchKind.Ok && isTokenValue(inner.value)) {
          visit(inner);
          return;
        }
        tokens.push({
          ...match.value,
          normalizedSpan: { ...match.normalizedSpan },
          originalSpan: { ...match.originalSpan },
        });
        return;
      }
      for (const child of match.matches) visit(child);
      return;
    }
    if (match.kind === MatchKind.Fail) {
      for (const child of match.matches) visit(child);
    }
  }

  visit(node);
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
