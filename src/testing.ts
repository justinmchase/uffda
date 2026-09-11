/**
 * Small, generic test-only helpers shared across test files. Unlike
 * `test.ts` (a debug-diagnostics harness for expression/pattern/rule
 * assertions), this module holds simple utilities with no dependency on the
 * runtime's match/scope machinery.
 */

/** Drains an async iterable into an array, for use in test assertions. */
export async function collect<T>(value: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of value) {
    result.push(item);
  }
  return result;
}
