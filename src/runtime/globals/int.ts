import { defineMetadata } from "../value_metadata.ts";
import { stringText } from "../conversion.ts";

export function int(value: unknown): number {
  return parseInt(stringText(value), 10);
}

defineMetadata(int, {
  description: "Parses a value as a base-10 integer.",
  parameters: [{ name: "value" }],
});
