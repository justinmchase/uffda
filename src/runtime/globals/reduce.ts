/**
 * Reduce an array (or string, as an array-like) to a single accumulated
 * value. Authors write `(reduce items initial fn)`, where `fn` is a lambda
 * (`<acc:any item:any> -> ...`) or a named module func:
 * `func Sum<acc:any item:any> = (add acc item);`.
 *
 * Matches JS `Array.prototype.reduce`'s exact contract deliberately (same
 * naming/shape philosophy as `slice`: mirror the host runtime 1:1) — `fn`
 * is called as `fn(acc, item)` and returns the next accumulator. This one
 * primitive subsumes both "fold" (accumulator is a scalar) and "scan"
 * (accumulator is a growing array/object, e.g. `[...acc, item]`); no
 * separate `scan` global is needed, exactly as in JS itself.
 *
 * Funcs/lambdas are invoked asynchronously, so each step's result is
 * awaited before the next.
 */
export async function reduce(
  self: ArrayLike<unknown>,
  initial: unknown,
  fn: (acc: unknown, item: unknown) => unknown,
): Promise<unknown> {
  let acc = initial;
  for (let i = 0; i < self.length; i++) {
    acc = await fn(acc, self[i]);
  }
  return acc;
}
