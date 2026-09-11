/**
 * Generic length: works for strings, arrays, Sets, and Maps.
 * Authors write `(length value)`.
 */
export function length(value: unknown): number {
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length;
  }
  if (value instanceof Set || value instanceof Map) {
    return value.size;
  }
  throw new TypeError("length expects a string, array, Set, or Map");
}
