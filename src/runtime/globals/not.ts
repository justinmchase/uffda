import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/** Boolean negation for projection calls. Authors write `(not value)`. */
export function not(value: unknown): boolean {
  return !rawOf(value);
}

defineMetadata(not, {
  description: "Boolean negation.",
  parameters: [{ name: "value" }],
});
