import { iterable } from "./iterable.ts";

/**
 * Keep elements of a value whose (async) predicate is truthy. Lazy —
 * nothing is iterated until the caller drains the result (`for await`,
 * `reduce`, or a spread context that collects it).
 * Authors write `(filter items SomeFunc)`, where `SomeFunc` is a named
 * module func or lambda. Funcs are invoked asynchronously, so predicate
 * results are always awaited. Only the element value is passed to the
 * predicate — use `enumerate` first when the index is also needed.
 *
 * Accepts anything `iterable()` does (strings, arrays, Sets, Maps, custom
 * (async) iterables, including another lazy `map`/`filter`/`enumerate`
 * result) — one shared iteration model, not `ArrayLike`-specific.
 */
export async function* filter(
  self: unknown,
  predicate: (value: unknown) => unknown,
): AsyncGenerator<unknown> {
  for await (const item of iterable(self)) {
    if (await predicate(item)) {
      yield item;
    }
  }
}
