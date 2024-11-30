import { assertNumber } from "@justinmchase/type";

export function add(
  left: unknown,
  right: unknown,
) {
  assertNumber(left);
  assertNumber(right);
  return left + right;
}
