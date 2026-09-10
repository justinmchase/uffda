import { document_id } from "./document_id.ts";
import type { SourceUnit } from "./units.ts";

export type SourceDocument = {
  documentId: string;
  text: string;
  lineStarts: number[];
  units: SourceUnit[];
  normalizationMap: number[];
  [Symbol.iterator](): Iterator<string>;
};

/**
 * Assemble a SourceDocument with iterable text surface.
 * Authors write `(source_document text lineStarts units normalizationMap)`.
 * Object literals cannot attach Symbol.iterator — always use this helper.
 */
export function source_document(
  text: string,
  lineStarts: number[],
  units: SourceUnit[],
  normalizationMap: number[],
): SourceDocument {
  if (typeof text !== "string") {
    throw new TypeError("source_document expects text to be a string");
  }
  if (
    !Array.isArray(lineStarts) ||
    !Array.isArray(units) ||
    !Array.isArray(normalizationMap)
  ) {
    throw new TypeError(
      "source_document expects lineStarts, units, and normalizationMap arrays",
    );
  }
  return {
    documentId: document_id(text),
    text,
    lineStarts,
    units,
    normalizationMap,
    [Symbol.iterator](): Iterator<string> {
      return text[Symbol.iterator]();
    },
  };
}
