import { Type, type } from "@justinmchase/type";
import { Input } from "../../input.ts";

function isPlainObject(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  const [t] = type(value);
  return t === Type.Object;
}

/**
 * Pair each element of a value with its index. Lazy — nothing is iterated
 * until the caller drains the result (`for await`, `reduce`, or a spread
 * context that collects it).
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
 *
 * Total: anything else (a bare number, boolean, `null`, …) is treated as a
 * one-item enumeration of itself (`{index: 0, value: self}`), mirroring how
 * `Input` already wraps a scalar into a singleton stream
 * (`InputNormalizationMode.Scalar`). `enumerate` never throws.
 */
export async function* enumerate(
  self: unknown,
): AsyncGenerator<{ index: number | string; value: unknown }> {
  if (
    isPlainObject(self) && !Input.isIterable(self) &&
    !Input.isAsyncIterable(self)
  ) {
    for (const [index, value] of Object.entries(self)) {
      yield { index, value };
    }
    return;
  }

  if (Input.isIterable(self) || Input.isAsyncIterable(self)) {
    let index = 0;
    for await (const value of self) {
      yield { index, value };
      index += 1;
    }
    return;
  }

  yield { index: 0, value: self };
}
