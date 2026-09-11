function hasAsyncIterator(
  value: unknown,
): value is AsyncIterable<unknown> {
  return (
    value != null &&
    typeof (value as Record<PropertyKey, unknown>)[Symbol.asyncIterator] ===
      "function"
  );
}

function hasIterator(value: unknown): value is Iterable<unknown> {
  return (
    value != null &&
    typeof (value as Record<PropertyKey, unknown>)[Symbol.iterator] ===
      "function"
  );
}

/**
 * Normalize any sync or async iterable into an async iterable.
 * Authors write `(iterable value)`.
 *
 * - Values that already implement `Symbol.asyncIterator` are returned
 *   unchanged.
 * - Values that only implement `Symbol.iterator` (strings, arrays, Sets,
 *   Maps, …) are wrapped so `Symbol.asyncIterator` drives the same
 *   underlying sync iterator; `await`-ing a non-promise value resolves
 *   immediately, so this adds no observable delay for existing sync
 *   consumers.
 *
 * This is a generic, value-shape-agnostic helper — not tied to any
 * particular domain (e.g. source documents) — so authors can attach a
 * uniform async iteration surface to any collection value, for example
 * via a computed `[(symbol "asyncIterator")]` object key.
 */
export function iterable(value: unknown): AsyncIterable<unknown> {
  if (hasAsyncIterator(value)) {
    return value;
  }
  if (hasIterator(value)) {
    const source = value;
    return {
      [Symbol.asyncIterator](): AsyncIterator<unknown> {
        const iterator = source[Symbol.iterator]();
        return {
          next: async () => await iterator.next(),
        };
      },
    };
  }
  throw new TypeError(
    "iterable expects a value with Symbol.iterator or Symbol.asyncIterator",
  );
}
