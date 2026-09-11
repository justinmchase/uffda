/**
 * Index into a string or array by position. Authors write `(at value index)`.
 * Matches JS indexing semantics: out-of-range returns `undefined`; negative
 * indices are not special-cased (use `(sub (length value) n)` explicitly).
 */
export function at(value: unknown, index: unknown): unknown {
  if (typeof value === "string" || Array.isArray(value)) {
    return (value as ArrayLike<unknown>)[index as number];
  }
  throw new TypeError("at expects a string or array");
}
