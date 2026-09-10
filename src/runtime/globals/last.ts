/**
 * Last element of a string or array, or `fallback` when empty.
 * Authors write `(last items fallback)`. Eager expression-invocation
 * arguments mean `fallback` is not evaluated lazily, so keep it cheap (a
 * literal or already-computed value).
 */
export function last(
  self: ArrayLike<unknown>,
  fallback: unknown,
): unknown {
  return self.length > 0 ? self[self.length - 1] : fallback;
}
