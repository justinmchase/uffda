import { defineMetadata } from "../value_metadata.ts";

/** Boolean negation for projection calls. Authors write `(not value)`. */
export function not(value: unknown): boolean {
  return !value;
}

defineMetadata(not, {
  description: "Boolean negation.",
  parameters: [{ name: "value" }],
});
