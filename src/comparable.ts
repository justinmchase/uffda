import type { Serializable } from "@justinmchase/serializable";

export type Comparable =
  & Serializable
  & (
    | number
    | string
    | { compareTo(value: unknown): number; toJSON(): Serializable }
  );
