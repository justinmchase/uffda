import { encodeBase58 } from "@std/encoding/base58";

/**
 * Base58 (Bitcoin alphabet) encoding of bytes.
 * Authors write `(base58 bytes)`, typically composed with `sha256`.
 */
export function base58(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("base58 expects a Uint8Array");
  }
  return encodeBase58(bytes);
}
