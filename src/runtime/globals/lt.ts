import { compare } from "./compare.ts";
import { defineMetadata } from "../value_metadata.ts";

/** True if `left` sorts strictly before `right`. Authors write `(lt left right)`. */
export function lt(left: unknown, right: unknown): boolean {
  return compare(left, right) < 0;
}

defineMetadata(lt, {
  description: "True if left sorts strictly before right.",
  parameters: [{ name: "left" }, { name: "right" }],
});
