import { Serializable } from "./runtime/hash.ts";

export type Comparable =
  | number
  | string
  | { compareTo(value: unknown): number; toJSON(): Serializable };
