import { defineMetadata } from "../value_metadata.ts";

export function json(self: unknown) {
  return JSON.stringify(self);
}

defineMetadata(json, {
  description: "Serializes a value as JSON text.",
  parameters: [{ name: "self" }],
});
