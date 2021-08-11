import { crypto } from '../../deps/std.ts'
import { Pattern } from './patterns/mod.ts'

const toHexString = (bytes: ArrayBuffer): string =>
  new Uint8Array(bytes).reduce(
    (str, byte) => str + byte.toString(16).padStart(2, "0"),
    "",
  );

export function hash(pattern: Pattern): string {
  const inputString = JSON.stringify(pattern)
  const inputBytes = new TextEncoder().encode(inputString);
  const h = crypto.subtle.digestSync("SHA-384", inputBytes) // todo: make it all async...
  return toHexString(h)
}