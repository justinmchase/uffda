/**
 * Map token values to semantic texts, omitting comments.
 * Authors write `(semantic_texts tokens)`.
 */
export function semantic_texts(
  tokens: ReadonlyArray<{ kind: string; text: string }>,
): string[] {
  if (!Array.isArray(tokens)) {
    throw new TypeError("semantic_texts expects an array");
  }
  return tokens
    .filter((token) => token.kind !== "comment")
    .map((token) => {
      if (typeof token?.text !== "string") {
        throw new TypeError("semantic_texts entries need a string text");
      }
      return token.text;
    });
}

/**
 * Map token values to word/punctuation texts only (no whitespace/comments).
 * Authors write `(semantic_no_whitespace_texts tokens)`.
 */
export function semantic_no_whitespace_texts(
  tokens: ReadonlyArray<{ kind: string; text: string }>,
): string[] {
  if (!Array.isArray(tokens)) {
    throw new TypeError("semantic_no_whitespace_texts expects an array");
  }
  return tokens
    .filter((token) => token.kind === "word" || token.kind === "punctuation")
    .map((token) => {
      if (typeof token?.text !== "string") {
        throw new TypeError(
          "semantic_no_whitespace_texts entries need a string text",
        );
      }
      return token.text;
    });
}
