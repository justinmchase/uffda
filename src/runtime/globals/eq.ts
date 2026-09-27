import { defineMetadata } from "../value_metadata.ts";

/** Strict equality for projection conditionals. */
export function eq(left: unknown, right: unknown): boolean {
  return left === right;
}

defineMetadata(eq, {
  description: "Strict equality.",
  parameters: [{ name: "left" }, { name: "right" }],
});
