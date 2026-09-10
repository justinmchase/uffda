import { checksum } from "./checksum.ts";

/**
 * Deterministic document id: `source:${length}:${checksum}`.
 * Authors write `(document_id text)`.
 */
export function document_id(text: string): string {
  if (typeof text !== "string") {
    throw new TypeError("document_id expects a string");
  }
  return `source:${text.length}:${checksum(text)}`;
}
