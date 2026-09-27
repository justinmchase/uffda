import { defineMetadata } from "../value_metadata.ts";

export function int(value: unknown): number {
  return parseInt(String(value), 10);
}

defineMetadata(int, {
  description: "Parses a value as a base-10 integer.",
  parameters: [{ name: "value" }],
});
