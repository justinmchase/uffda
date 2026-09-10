/**
 * FNV-1a-style 32-bit checksum as 8 hex digits.
 * Authors write `(checksum text)`. Must stay bit-stable for documentId.
 */
export function checksum(text: string): string {
  if (typeof text !== "string") {
    throw new TypeError("checksum expects a string");
  }
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
