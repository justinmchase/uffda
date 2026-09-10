/**
 * Keep elements of a string or array whose (async) predicate is truthy.
 * Authors write `(filter items SomeFunc)`, where `SomeFunc` is a named module
 * func: `func SomeFunc<v:any> = ...;`. Funcs are invoked asynchronously, so
 * predicate results are always awaited. Only the element value is passed to
 * the predicate — use `enumerate` first when the index is also needed.
 */
export async function filter(
  self: ArrayLike<unknown>,
  predicate: (value: unknown) => unknown,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let i = 0; i < self.length; i++) {
    const value = self[i];
    if (await predicate(value)) {
      results.push(value);
    }
  }
  return results;
}
