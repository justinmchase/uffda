import { defineMetadata } from "../value_metadata.ts";
import { rawOf, unwrap } from "../../wrapped.ts";

/**
 * Convert a collection into a Set of its elements.
 * Authors write `(to_set items)`.
 *
 * Reserved: expression `(set a b c)` is set *literal* construction (see
 * expression-syntax array/object structuring), not this conversion helper.
 */
/** Sets compare members by value, so they hold raw values. */
function rawSet(values: Iterable<unknown>): Set<unknown> {
  const set = new Set<unknown>();
  for (const value of values) set.add(unwrap(value));
  return set;
}

export function to_set(self: unknown): Set<unknown> {
  const items = rawOf(self);
  if (Array.isArray(items)) {
    return rawSet(items);
  }
  if (items instanceof Set) {
    return rawSet(items);
  }
  if (items instanceof Map) {
    return rawSet(items.values());
  }
  if (items != null && typeof items === "object") {
    return rawSet(Object.values(items as Record<PropertyKey, unknown>));
  }
  throw new TypeError("to_set expects an array, object, Map, or Set");
}

defineMetadata(to_set, {
  description: "Converts a collection into a Set.",
  parameters: [{ name: "items" }],
});
