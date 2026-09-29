import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/**
 * Membership check for Sets, Maps, arrays, and own object keys.
 * Authors write `(has collection value)`.
 */
export function has(self: unknown, item: unknown): boolean {
  const collection = rawOf(self);
  const value = rawOf(item);
  if (collection instanceof Set || collection instanceof Map) {
    return collection.has(value as never);
  }
  if (Array.isArray(collection)) {
    return collection.some((element) => {
      const raw = rawOf(element);
      return raw === value || (raw !== raw && value !== value);
    });
  }
  if (collection != null && typeof collection === "object") {
    return Object.prototype.hasOwnProperty.call(
      collection,
      value as PropertyKey,
    );
  }
  return false;
}

defineMetadata(has, {
  description: "Whether a Set, Map, array, or object contains a value or key.",
  parameters: [{ name: "collection" }, { name: "value" }],
});
