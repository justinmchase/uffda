import { assertNumber } from "@justinmchase/type";
import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

export function add(
  left: unknown,
  right: unknown,
) {
  const l = rawOf(left);
  const r = rawOf(right);
  assertNumber(l);
  assertNumber(r);
  return l + r;
}

defineMetadata(add, {
  description: "Adds two numbers.",
  parameters: [{ name: "left" }, { name: "right" }],
});
