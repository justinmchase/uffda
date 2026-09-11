/**
 * Generic three-way comparison. Authors write `(compare left right)`.
 * Returns `-1` if `left` sorts before `right`, `1` if it sorts after, and
 * `0` if they are equal. Supports numbers and strings (the two ordered
 * primitive types ExpressionLang programs commonly compare); anything else
 * throws so callers don't get a silently wrong ordering.
 */
export function compare(left: unknown, right: unknown): number {
  if (
    (typeof left !== "number" && typeof left !== "string") ||
    (typeof right !== "number" && typeof right !== "string") ||
    typeof left !== typeof right
  ) {
    throw new TypeError("compare expects two numbers or two strings");
  }
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
