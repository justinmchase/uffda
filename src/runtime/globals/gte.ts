import { compare } from "./compare.ts";

/** True if `left` sorts after or equal to `right`. Authors write `(gte left right)`. */
export function gte(left: unknown, right: unknown): boolean {
  return compare(left, right) >= 0;
}
