/**
 * Pair each element of a string or array with its index.
 * Authors write `(enumerate items)`, then destructure via a func parameter
 * pattern such as `p:{index:number, value:string}`. This is the index-aware
 * counterpart to `map`/`filter`, which only pass the element value.
 *
 * Strings are iterated by Unicode code point (via `for...of`), not UTF-16
 * code unit, so astral-plane characters (surrogate pairs, e.g. emoji) are
 * kept as a single entry rather than split into two.
 */
export function enumerate(
  self: string | unknown[],
): { index: number; value: unknown }[] {
  const results: { index: number; value: unknown }[] = [];
  if (typeof self === "string") {
    let index = 0;
    for (const value of self) {
      results.push({ index, value });
      index += 1;
    }
    return results;
  }
  if (Array.isArray(self)) {
    for (let i = 0; i < self.length; i++) {
      results.push({ index: i, value: self[i] });
    }
    return results;
  }
  throw new TypeError("enumerate expects a string or array");
}
