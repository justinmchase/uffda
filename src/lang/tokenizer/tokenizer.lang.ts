import type { SourceDocument } from "../source/mod.ts";

/** Token kinds emitted by `mod.uff` (see `tokenization.spec.md`). */
export enum StructuredTokenKind {
  Whitespace = "whitespace",
  NewLine = "newline",
  Word = "word",
  Punctuation = "punctuation",
  Comment = "comment",
}

/** A token value: kind and text only. Source spans live on Matches. */
export type TokenValue = {
  kind: StructuredTokenKind;
  text: string;
};

export function isTokenValue(value: unknown): value is TokenValue {
  if (value == null || typeof value !== "object") return false;
  const token = value as Partial<TokenValue>;
  return Object.values(StructuredTokenKind).includes(
    token.kind as StructuredTokenKind,
  ) && typeof token.text === "string";
}

export type TokenizerLangValue = {
  source: SourceDocument;
  /**
   * Parser-compatible semantic token texts (comments omitted). Lazily
   * produced by the `.uff` `semantic_texts` func (built on `map`/`filter`);
   * drain with `for await`/`collect()` before comparing to a literal array.
   */
  tokens: AsyncIterable<string>;
};
