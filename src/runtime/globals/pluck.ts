import { defineMetadata } from "../value_metadata.ts";
import { isWrapped, rawOf, wrap } from "../../wrapped.ts";

function propertyAt(element: unknown, key: PropertyKey): unknown {
  const item = rawOf(element);
  if (
    item != null && (typeof item === "object" || typeof item === "function")
  ) {
    const value = (item as Record<PropertyKey, unknown>)[key];
    return isWrapped(element) ? wrap(value, element.origin) : value;
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
export function pluck(collection: unknown, key: unknown): unknown[] {
  const k = rawOf(key) as PropertyKey;
  return elementsOf(rawOf(collection)).map((item) => propertyAt(item, k));
}

defineMetadata(pluck, {
  description: "Collects item[key] for each element of a collection.",
  parameters: [{ name: "collection" }, { name: "key" }],
});
