/**
 * SHA-256 digest of a string, as raw bytes.
 * Authors write `(sha256 text)`. Compose with `base58`/`slice` for
 * human-readable, truncatable identifiers.
 */
export async function sha256(text: string): Promise<Uint8Array> {
  if (typeof text !== "string") {
    throw new TypeError("sha256 expects a string");
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}
