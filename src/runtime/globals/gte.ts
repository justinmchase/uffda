import { compare } from "./compare.ts";
import { defineMetadata } from "../value_metadata.ts";

/** True if `left` sorts after or equal to `right`. Authors write `(gte left right)`. */
export function gte(left: unknown, right: unknown): boolean {
  return compare(left, right) >= 0;
}

defineMetadata(gte, {
  description: "True if left sorts after or equal to right.",
  parameters: [{ name: "left" }, { name: "right" }],
});
