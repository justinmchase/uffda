import { defineMetadata } from "../value_metadata.ts";
import { unwrap } from "../../wrapped.ts";

export function json(self: unknown) {
  return JSON.stringify(unwrap(self));
}

defineMetadata(json, {
  description: "Serializes a value as JSON text.",
  parameters: [{ name: "self" }],
});
