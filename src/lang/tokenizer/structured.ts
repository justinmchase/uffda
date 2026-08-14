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
