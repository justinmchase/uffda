import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/** Strict equality for projection conditionals. */
export function eq(left: unknown, right: unknown): boolean {
  return rawOf(left) === rawOf(right);
}

defineMetadata(eq, {
  description: "Strict equality.",
  parameters: [{ name: "left" }, { name: "right" }],
});
