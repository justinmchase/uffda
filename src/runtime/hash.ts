import { crypto } from "../../deps/std.ts";

export type Serializable =
  | undefined
  | null
  | string
  | number
  | boolean
  | Date
  | { toJSON(): Serializable }
  | Serializable[]
  | ISerializable;

export interface ISerializable {
  [key: string]: Serializable;
}

const toHexString = (bytes: ArrayBuffer): string =>
  new Uint8Array(bytes).reduce(
    (str, byte) => str + byte.toString(16).padStart(2, "0"),
    "",
  );

export function hash(serializable: Serializable): string {
  const inputString = JSON.stringify(serializable);
  const inputBytes = new TextEncoder().encode(inputString);
  const h = crypto.subtle.digestSync("SHA-384", inputBytes); // todo: make it all async...
  return toHexString(h);
}
