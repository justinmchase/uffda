import { iterable } from "./iterable.ts";

/**
 * Reduce a value to a single accumulated value. Authors write
 * `(reduce items initial fn)`, where `fn` is a lambda (`<acc:any item:any>
 * -> ...`) or a named module func: `func Sum<acc:any item:any> = (add acc
 * item);`.
 *
 * Matches JS `Array.prototype.reduce`'s exact contract deliberately (same
 * naming/shape philosophy as `slice`: mirror the host runtime 1:1) — `fn`
 * is called as `fn(acc, item)` and returns the next accumulator. This one
 * primitive subsumes both "fold" (accumulator is a scalar) and "scan"
 * (accumulator is a growing array/object, e.g. `[...acc, item]`); no
 * separate `scan` global is needed, exactly as in JS itself.
 *
 * `reduce` is the eager "drain" counterpart to `enumerate`/`map`/`filter`:
 * it accepts anything `iterable()` does (strings, arrays, Sets, Maps,
 * custom (async) iterables, including a lazy `map`/`filter`/`enumerate`
 * result) and consumes it fully. Strings are iterated by Unicode code
 * point, not UTF-16 code unit, so astral-plane characters (surrogate
 * pairs, e.g. emoji) are passed to `fn` as a single item rather than two.
 *
 * Funcs/lambdas are invoked asynchronously, so each step's result is
 * awaited before the next.
 */
export async function reduce(
  self: unknown,
  initial: unknown,
  fn: (acc: unknown, item: unknown) => unknown,
): Promise<unknown> {
  let acc = initial;
  for await (const item of iterable(self)) {
    acc = await fn(acc, item);
  }
  return acc;
}
