export type Comparable =
  | number
  | string
  | { compareTo(value: unknown): number };
