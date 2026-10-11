import { defineMetadata } from "../value_metadata.ts";
import { jsonText } from "../conversion.ts";

export function json(self: unknown) {
  return jsonText(self);
}

defineMetadata(json, {
  description: "Serializes a value as JSON text.",
  parameters: [{ name: "self" }],
});
