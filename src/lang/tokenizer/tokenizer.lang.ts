import type { SourceDocument } from "../source/mod.ts";

export type TokenizerLangValue = {
  source: SourceDocument;
  /** Parser-compatible semantic token texts (comments omitted). */
  tokens: string[];
};
