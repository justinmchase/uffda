import { compare } from "./compare.ts";
import { defineMetadata } from "../value_metadata.ts";

/** True if `left` sorts strictly after `right`. Authors write `(gt left right)`. */
export function gt(left: unknown, right: unknown): boolean {
  return compare(left, right) > 0;
}

defineMetadata(gt, {
  description: "True if left sorts strictly after right.",
  parameters: [{ name: "left" }, { name: "right" }],
});
