import { Type, type } from "@justinmchase/type";

/**
 * Generic three-way comparison. Authors write `(compare left right)`.
 * Returns `-1` if `left` sorts before `right`, `1` if it sorts after, and
 * `0` if they are equal. Supports numbers and strings (the two ordered
 * primitive types ExpressionLang programs commonly compare); anything else
 * throws so callers don't get a silently wrong ordering.
 */
export function compare(left: unknown, right: unknown): number {
  const [lt, lv] = type(left);
  const [rt, rv] = type(right);
  if (lt !== rt) {
    throw new TypeError("compare expects two numbers or two strings");
  }
  switch (lt) {
    case Type.Number:
    case Type.String: {
      const l = lv as number | string;
      const r = rv as number | string;
      if (l === r) return 0;
      return l < r ? -1 : 1;
    }
    default:
      throw new TypeError("compare expects two numbers or two strings");
  }
}
