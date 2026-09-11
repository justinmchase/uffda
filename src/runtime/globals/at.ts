import { Type, type } from "@justinmchase/type";

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
  const [t, v] = type(value);
  const i = index as number;
  switch (t) {
    case Type.String:
    case Type.Array:
      return v[i];
    case Type.Set:
    case Type.Map:
      return nthEntry(v, i);
    case Type.Null:
    case Type.Undefined:
    case Type.BigInt:
    case Type.Boolean:
    case Type.Function:
    case Type.Number:
    case Type.Symbol:
    case Type.Error:
    case Type.Object:
    case Type.Date:
      throw new TypeError("at expects a string, array, Set, or Map");
  }
}
