import { Type, type } from "@justinmchase/type";
import { defineMetadata } from "../value_metadata.ts";
import {
  carryItem,
  isWrapped,
  rawOf,
  sliceString,
  type Wrapped,
} from "../../wrapped.ts";

function nthEntry<T>(items: Iterable<T>, index: number): T | undefined {
  let position = 0;
  for (const entry of items) {
    if (position === index) return entry;
    position++;
  }
  return undefined;
}

/**
 * Index into a string, array, Set, or Map by ordinal position. Authors write
 * `(at value index)`. Matches JS indexing semantics for strings/arrays:
 * out-of-range returns `undefined`; negative indices are not special-cased
 * (use `(sub (length value) n)` explicitly). Sets and Maps have no native
 * index operator, so they're walked in iteration (insertion) order — the
 * same order `enumerate`/`length` already use for them — returning the
 * `index`-th value (Set) or `[key, value]` entry (Map).
 */
export function at(value: unknown, index: unknown): unknown {
  const [t, v] = type(rawOf(value));
  const i = rawOf(index) as number;
  switch (t) {
    case Type.String:
      return isWrapped(value) && v[i] !== undefined
        ? sliceString(value as Wrapped<string>, i, i + 1)
        : v[i];
    case Type.Array:
      return carryItem(value, v[i], i);
    case Type.Set:
    case Type.Map:
      return carryItem(value, nthEntry(v, i), i);
    default:
      throw new TypeError("at expects a string, array, Set, or Map");
  }
}

defineMetadata(at, {
  description:
    "The element at an ordinal index of a string, array, Set, or Map.",
  parameters: [{ name: "value" }, { name: "index" }],
});
