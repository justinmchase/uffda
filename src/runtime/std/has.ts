/**
 * Membership check for Sets, Maps, arrays, and own object keys.
 * Authors write `(has collection value)`.
 */
export function has(collection: unknown, value: unknown): boolean {
  if (collection instanceof Set || collection instanceof Map) {
    return collection.has(value as never);
  }
  if (Array.isArray(collection)) {
    return collection.includes(value);
  }
  if (collection != null && typeof collection === "object") {
    return Object.prototype.hasOwnProperty.call(
      collection,
      value as PropertyKey,
    );
  }
  return false;
}
