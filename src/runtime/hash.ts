import { crypto } from "@std/crypto";
import { encodeHex } from "@std/encoding/hex";
import type { Serializable } from "@justinmchase/serializable";

export async function hash(serializable: Serializable): Promise<string> {
  const inputString = JSON.stringify(serializable);
  const inputBytes = new TextEncoder().encode(inputString);
  const h = await crypto.subtle.digest("SHA-384", inputBytes);
  return encodeHex(h);
}
