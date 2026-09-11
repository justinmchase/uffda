import { iterable } from "./globals/iterable.ts";

/**
 * True only for actual (async) generator objects — the values produced by
 * `async function*`/`function*`, e.g. `map`/`filter`/`enumerate`. Narrower
 * than "has `Symbol.iterator`/`Symbol.asyncIterator`": a plain domain
 * object (such as `SourceDocument`, which exposes `Symbol.asyncIterator`
 * for downstream stream consumption while remaining a regular record) must
 * not be mistaken for a lazy sequence and drained/replaced.
 */
export function isGenerator(value: unknown): boolean {
  const tag = Object.prototype.toString.call(value);
  return tag === "[object Generator]" || tag === "[object AsyncGenerator]";
}

/**
 * Drain any sync or async iterable value into a real array. Used at the
 * runtime's "sink" points — array/invocation spread — where a lazily
 * produced sequence (e.g. from `enumerate`/`map`/`filter`) must become a
 * concrete array before it can be spread with native JS `...` or compared
 * for equality. Reuses `iterable()`'s normalization, so it accepts anything
 * `iterable()` does (strings, arrays, Sets, Maps, custom (async) iterables)
 * and throws the same `TypeError` for anything else.
 */
export async function collect(value: unknown): Promise<unknown[]> {
  const result: unknown[] = [];
  for await (const item of iterable(value)) {
    result.push(item);
  }
  return result;
}
