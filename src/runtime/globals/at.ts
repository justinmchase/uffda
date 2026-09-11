import { isArray, isMap, isSet, isString } from "@justinmchase/type";

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
  if (isString(value) || isArray(value)) {
    return (value as ArrayLike<unknown>)[index as number];
  }
  if (isSet(value) || isMap(value)) {
    let position = 0;
    for (const entry of value) {
      if (position === index) return entry;
      position++;
    }
    return undefined;
  }
  throw new TypeError("at expects a string, array, Set, or Map");
}
