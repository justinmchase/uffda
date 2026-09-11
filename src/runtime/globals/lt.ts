import { compare } from "./compare.ts";

/** True if `left` sorts strictly before `right`. Authors write `(lt left right)`. */
export function lt(left: unknown, right: unknown): boolean {
  return compare(left, right) < 0;
}
