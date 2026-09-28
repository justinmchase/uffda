import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

export function coalesce(...values: unknown[]) {
  for (const value of values) {
    if (rawOf(value) != null) {
      return value;
    }
  }
  return undefined;
}

defineMetadata(coalesce, {
  description: "The first argument that is neither null nor undefined.",
  parameters: [{ name: "values", rest: true }],
});
