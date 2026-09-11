import { iterable } from "./iterable.ts";

/**
 * Lazily thread a running accumulator across a value, yielding the updated
 * accumulator after each step (the "scanl" a.k.a. "running reduce"
 * primitive — RxJS calls this `scan`, Haskell calls it `scanl1`). Authors
 * write `(scan items initial fn)`, where `fn` is a lambda (`<acc:any
 * item:any> -> ...`) or a named module func, called exactly like
 * `reduce`'s `fn`: `fn(acc, item)` returns the next accumulator.
 *
 * Unlike `reduce`, which drains eagerly to a single final value, `scan` is
 * lazy and yields once per input item — nothing is iterated until the
 * caller drains the result (`for await`, `reduce`, or a spread context that
 * collects it). This is the primitive to reach for whenever a `.uff` author
 * needs one output record per input item while carrying running state
 * (e.g. a running byte offset), instead of hand-rolling it with `reduce`
 * and `[...acc, item]`: rebuilding the accumulator array by spreading it on
 * every step is O(n) per step (O(n^2) overall) once outputs are collected
 * into an array, since each step copies every previously accumulated
 * output. `scan` never rebuilds prior output — it is O(n) overall — because
 * only the (typically small, e.g. `{offset}`) running accumulator is
 * threaded between steps, not a growing array of every step's output.
 *
 * Accepts anything `iterable()` does (strings, arrays, Sets, Maps, custom
 * (async) iterables, including another lazy `map`/`filter`/`enumerate`/
 * `scan` result) — one shared iteration model, not `ArrayLike`-specific.
 */
export async function* scan(
  self: unknown,
  initial: unknown,
  fn: (acc: unknown, item: unknown) => unknown,
): AsyncGenerator<unknown> {
  let acc = initial;
  for await (const item of iterable(self)) {
    acc = await fn(acc, item);
    yield acc;
  }
}
