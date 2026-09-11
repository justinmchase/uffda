import type { SourceDocument } from "../source/mod.ts";

export type TokenizerLangValue = {
  source: SourceDocument;
  /**
   * Parser-compatible semantic token texts (comments omitted). Lazily
   * produced by the `.uff` `semantic_texts` func (built on `map`/`filter`);
   * drain with `for await`/`collect()` before comparing to a literal array.
   */
  tokens: AsyncIterable<string>;
};
