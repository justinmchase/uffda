import type { Match, MatchOk } from "../../match.ts";
import { MatchKind } from "../../match.ts";
import type { ItemSourceSpan, SourceSpan } from "../../span.ts";

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

/**
 * Fold `#` line comments outside quoted strings into Comment trivia tokens.
 * Quote/escape tracking remains host-side so interpolation delimiters stay
 * independently tokenizable; comment text is preserved as trivia without spans.
 */
export function foldLineComments(tokens: TokenValue[]): TokenValue[] {
  const out: TokenValue[] = [];
  let inString = false;
  let escaped = false;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (inString) {
      out.push(token);
      if (token.text === '"' && !escaped) inString = false;
      escaped = inString && token.text === "\\" && !escaped;
      i++;
      continue;
    }

    if (token.text === '"') {
      inString = true;
      escaped = false;
      out.push(token);
      i++;
      continue;
    }

    if (
      token.kind === StructuredTokenKind.Punctuation && token.text === "#"
    ) {
      let text = token.text;
      i++;
      while (
        i < tokens.length &&
        tokens[i].kind !== StructuredTokenKind.NewLine
      ) {
        text += tokens[i].text;
        i++;
      }
      out.push({
        kind: StructuredTokenKind.Comment,
        text,
      });
      continue;
    }

    escaped = false;
    out.push(token);
    i++;
  }

  return out;
}

export function toSemanticTexts(tokens: TokenValue[]): string[] {
  return tokens
    .filter((token) => token.kind !== StructuredTokenKind.Comment)
    .map((token) => token.text);
}

export function toSemanticNoWhitespaceTexts(tokens: TokenValue[]): string[] {
  return tokens
    .filter(isSemanticNoWhitespaceToken)
    .map((token) => token.text);
}

type SpannedToken = TokenValue & {
  normalizedSpan: SourceSpan;
  originalSpan: SourceSpan;
};

function collectRawSpannedTokens(node: Match): SpannedToken[] {
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

function foldSpannedLineComments(tokens: SpannedToken[]): SpannedToken[] {
  const out: SpannedToken[] = [];
  let inString = false;
  let escaped = false;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (inString) {
      out.push(token);
      if (token.text === '"' && !escaped) inString = false;
      escaped = inString && token.text === "\\" && !escaped;
      i++;
      continue;
    }

    if (token.text === '"') {
      inString = true;
      escaped = false;
      out.push(token);
      i++;
      continue;
    }

    if (
      token.kind === StructuredTokenKind.Punctuation && token.text === "#"
    ) {
      let text = token.text;
      let normalizedEnd = token.normalizedSpan.end;
      let originalEnd = token.originalSpan.end;
      i++;
      while (
        i < tokens.length &&
        tokens[i].kind !== StructuredTokenKind.NewLine
      ) {
        text += tokens[i].text;
        normalizedEnd = tokens[i].normalizedSpan.end;
        originalEnd = tokens[i].originalSpan.end;
        i++;
      }
      out.push({
        kind: StructuredTokenKind.Comment,
        text,
        normalizedSpan: {
          start: token.normalizedSpan.start,
          end: normalizedEnd,
        },
        originalSpan: {
          start: token.originalSpan.start,
          end: originalEnd,
        },
      });
      continue;
    }

    escaped = false;
    out.push(token);
    i++;
  }

  return out;
}

/** Character spans for TokenizerNoWhitespace semantic tokens, in stream order. */
export function itemSpansFromTokenizerMatch(
  match: MatchOk,
): ItemSourceSpan[] {
  return foldSpannedLineComments(collectRawSpannedTokens(match))
    .filter(isSemanticNoWhitespaceToken)
    .map((token) => ({
      normalized: token.normalizedSpan,
      original: token.originalSpan,
    }));
}
