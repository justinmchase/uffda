import { assertNumber } from "@justinmchase/type";
import { defineMetadata } from "../value_metadata.ts";

export function add(
  left: unknown,
  right: unknown,
) {
  assertNumber(left);
  assertNumber(right);
  return left + right;
}

defineMetadata(add, {
  description: "Adds two numbers.",
  parameters: [{ name: "left" }, { name: "right" }],
});
