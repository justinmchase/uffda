/**
 * Project each element of a string or array through an (async) callback.
 * Authors write `(map items SomeFunc)`, where `SomeFunc` is a named module
 * func: `func SomeFunc<v:any> = ...;`. Funcs are invoked asynchronously, so
 * results are always awaited. Only the element value is passed to the
 * callback — use `enumerate` first when the index is also needed.
 */
export async function map(
  self: ArrayLike<unknown>,
  callback: (value: unknown) => unknown,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let i = 0; i < self.length; i++) {
    results.push(await callback(self[i]));
  }
  return results;
}
