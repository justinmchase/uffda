import { Serializable } from "serializable/mod.ts";

export type Comparable = Serializable & (
  | number
  | string
  | { compareTo(value: unknown): number; toJSON(): Serializable }
);
