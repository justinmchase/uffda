import { compare } from "./compare.ts";

/** True if `left` sorts strictly after `right`. Authors write `(gt left right)`. */
export function gt(left: unknown, right: unknown): boolean {
  return compare(left, right) > 0;
}
