import { crypto } from "std/crypto/mod.ts";
import { encodeHex } from "std/encoding/hex.ts";
import type { Serializable } from "serializable/mod.ts";

export async function hash(serializable: Serializable): Promise<string> {
  const inputString = JSON.stringify(serializable);
  const inputBytes = new TextEncoder().encode(inputString);
  const h = await crypto.subtle.digest("SHA-384", inputBytes);
  return encodeHex(h);
}
