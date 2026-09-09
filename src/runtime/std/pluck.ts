function propertyAt(item: unknown, key: PropertyKey): unknown {
  if (
    item != null && (typeof item === "object" || typeof item === "function")
  ) {
    return (item as Record<PropertyKey, unknown>)[key];
  }
  return undefined;
}

function elementsOf(collection: unknown): unknown[] {
  if (Array.isArray(collection)) {
    return collection;
  }
  if (collection instanceof Map) {
    return [...collection.values()];
  }
  if (collection instanceof Set) {
    return [...collection];
  }
  if (collection != null && typeof collection === "object") {
    return Object.values(collection as Record<PropertyKey, unknown>);
  }
  throw new TypeError("pluck expects an array, object, Map, or Set");
}

/**
 * Collect `item[key]` for each element of a collection.
 * Arrays iterate elements; Maps/Sets iterate values; plain objects iterate
 * own values. Authors write `(pluck items "name")`.
 */
export function pluck(collection: unknown, key: PropertyKey): unknown[] {
  return elementsOf(collection).map((item) => propertyAt(item, key));
}
