import { defineMetadata } from "../value_metadata.ts";

export function pack(...values: unknown[]) {
  return values;
}

defineMetadata(pack, {
  description: "Collects its arguments into an array.",
  parameters: [{ name: "values", rest: true }],
});
