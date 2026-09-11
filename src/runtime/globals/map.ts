import { iterable } from "./iterable.ts";

/**
 * Project each element of a value through an (async) callback. Lazy —
 * nothing is iterated until the caller drains the result (`for await`,
 * `reduce`, or a spread context that collects it).
 * Authors write `(map items SomeFunc)`, where `SomeFunc` is a named module
 * func or lambda. Funcs are invoked asynchronously, so results are always
 * awaited. Only the element value is passed to the callback — use
 * `enumerate` first when the index is also needed.
 *
 * Accepts anything `iterable()` does (strings, arrays, Sets, Maps, custom
 * (async) iterables, including another lazy `map`/`filter`/`enumerate`
 * result) — one shared iteration model, not `ArrayLike`-specific.
 */
export async function* map(
  self: unknown,
  callback: (value: unknown) => unknown,
): AsyncGenerator<unknown> {
  for await (const item of iterable(self)) {
    yield await callback(item);
  }
}
