import { assertNumber } from "@justinmchase/type";
import { defineMetadata } from "../value_metadata.ts";

/** Authors write `(sub left right)`. */
export function sub(
  left: unknown,
  right: unknown,
) {
  assertNumber(left);
  assertNumber(right);
  return left - right;
}

defineMetadata(sub, {
  description: "Subtracts right from left.",
  parameters: [{ name: "left" }, { name: "right" }],
});
