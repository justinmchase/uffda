import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/**
 * Generic length: works for strings, arrays, Sets, and Maps.
 * Authors write `(length value)`.
 */
export function length(self: unknown): number {
  const value = rawOf(self);
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length;
  }
  if (value instanceof Set || value instanceof Map) {
    return value.size;
  }
  throw new TypeError("length expects a string, array, Set, or Map");
}

defineMetadata(length, {
  description: "The length of a string, array, Set, or Map.",
  parameters: [{ name: "value" }],
});
