import { compare } from "./compare.ts";
import { defineMetadata } from "../value_metadata.ts";

/** True if `left` sorts before or equal to `right`. Authors write `(lte left right)`. */
export function lte(left: unknown, right: unknown): boolean {
  return compare(left, right) <= 0;
}

defineMetadata(lte, {
  description: "True if left sorts before or equal to right.",
  parameters: [{ name: "left" }, { name: "right" }],
});
