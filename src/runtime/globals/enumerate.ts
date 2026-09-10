/**
 * Pair each element of a string or array with its index.
 * Authors write `(enumerate items)`, then destructure via a func parameter
 * pattern such as `p:{index:number, value:string}`. This is the index-aware
 * counterpart to `map`/`filter`, which only pass the element value.
 */
export function enumerate(
  self: ArrayLike<unknown>,
): { index: number; value: unknown }[] {
  const results: { index: number; value: unknown }[] = [];
  for (let i = 0; i < self.length; i++) {
    results.push({ index: i, value: self[i] });
  }
  return results;
}
