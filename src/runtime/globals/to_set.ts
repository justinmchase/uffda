/**
 * Convert a collection into a Set of its elements.
 * Authors write `(to_set items)`.
 *
 * Reserved: expression `(set a b c)` is set *literal* construction (see
 * expression-syntax array/object structuring), not this conversion helper.
 */
export function to_set(items: unknown): Set<unknown> {
  if (Array.isArray(items)) {
    return new Set(items);
  }
  if (items instanceof Set) {
    return new Set(items);
  }
  if (items instanceof Map) {
    return new Set(items.values());
  }
  if (items != null && typeof items === "object") {
    return new Set(Object.values(items as Record<PropertyKey, unknown>));
  }
  throw new TypeError("to_set expects an array, object, Map, or Set");
}
