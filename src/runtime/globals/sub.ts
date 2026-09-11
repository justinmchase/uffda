import { assertNumber } from "@justinmchase/type";

/** Authors write `(sub left right)`. */
export function sub(
  left: unknown,
  right: unknown,
) {
  assertNumber(left);
  assertNumber(right);
  return left - right;
}
