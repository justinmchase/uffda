import { assertNumber } from "@justinmchase/type";
import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/** Authors write `(sub left right)`. */
export function sub(
  left: unknown,
  right: unknown,
) {
  const l = rawOf(left);
  const r = rawOf(right);
  assertNumber(l);
  assertNumber(r);
  return l - r;
}

defineMetadata(sub, {
  description: "Subtracts right from left.",
  parameters: [{ name: "left" }, { name: "right" }],
});
