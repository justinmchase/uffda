import { encodeBase58 } from "@std/encoding/base58";
import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/**
 * Base58 (Bitcoin alphabet) encoding of bytes.
 * Authors write `(base58 bytes)`, typically composed with `sha256`.
 */
export function base58(value: unknown): string {
  const bytes = rawOf(value);
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("base58 expects a Uint8Array");
  }
  return encodeBase58(bytes);
}

defineMetadata(base58, {
  description: "Base58 (Bitcoin alphabet) encoding of bytes.",
  parameters: [{ name: "bytes" }],
});
