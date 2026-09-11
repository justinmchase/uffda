import { compare } from "./compare.ts";

/** True if `left` sorts before or equal to `right`. Authors write `(lte left right)`. */
export function lte(left: unknown, right: unknown): boolean {
  return compare(left, right) <= 0;
}
