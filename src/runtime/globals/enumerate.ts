import { Input } from "../../input.ts";

function isPlainObject(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Pair each element of a value with its index.
 * Authors write `(enumerate items)`, then destructure via a func parameter
 * pattern such as `p:{index:number, value:string}`. This is the index-aware
 * counterpart to `map`/`filter`, which only pass the element value.
 *
 * Any sync or async iterable is supported (strings, arrays, Sets, Maps,
 * custom iterables/async iterables, …) via a single shared loop — strings
 * are iterated by Unicode code point (`for...of`/`for await...of` is
 * code-point aware), not UTF-16 code unit, so astral-plane characters
 * (surrogate pairs, e.g. emoji) are kept as a single entry rather than
 * split into two.
 *
 * Plain objects (no `Symbol.iterator`/`Symbol.asyncIterator`) are wrapped
 * via `Object.entries`, so `index` is the object's own key (a string)
 * rather than an ordinal position.
 */
export async function enumerate(
  self: unknown,
): Promise<{ index: number | string; value: unknown }[]> {
  const results: { index: number | string; value: unknown }[] = [];

  if (
    isPlainObject(self) && !Input.isIterable(self) &&
    !Input.isAsyncIterable(self)
  ) {
    for (const [index, value] of Object.entries(self)) {
      results.push({ index, value });
    }
    return results;
  }

  if (Input.isIterable(self) || Input.isAsyncIterable(self)) {
    let index = 0;
    for await (const value of self) {
      results.push({ index, value });
      index += 1;
    }
    return results;
  }

  throw new TypeError(
    "enumerate expects a string, array, iterable, async iterable, or plain object",
  );
}
