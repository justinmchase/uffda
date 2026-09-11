import { iterable } from "./globals/iterable.ts";

// The real, shared intrinsic prototypes for generator/async-generator
// instances, captured once from throwaway generator functions. Note: a
// generator instance's OWN prototype is that particular function's private
// `.prototype` object (every function has its own), not the shared
// intrinsic — so `Object.getPrototypeOf(instance)` differs per function.
// Going one level higher, via the generator *function's* own prototype
// (`GeneratorFunction.prototype`, shared by every generator function) and
// then its `.prototype` property, reaches the actual shared `%GeneratorPrototype%`
// / `%AsyncGeneratorPrototype%` intrinsics that every instance inherits from.
// JS has no public `Generator`/`AsyncGenerator` global to `instanceof`
// against, and `Object.prototype.toString.call(value)`'s
// `"[object Generator]"` tag is spoofable by any plain object that defines
// its own `Symbol.toStringTag`. `isPrototypeOf` against these captured
// prototypes checks the value's actual prototype chain instead, which
// cannot be faked without genuinely deriving from a generator function.
// Called via `Object.prototype.isPrototypeOf.call(...)` (not
// `proto.isPrototypeOf(value)`) per `no-prototype-builtins`.
const GeneratorPrototype = Object.getPrototypeOf(function* () {}).prototype;
const AsyncGeneratorPrototype =
  Object.getPrototypeOf(async function* () {}).prototype;

/**
 * True only for actual (async) generator objects — the values produced by
 * `async function*`/`function*`, e.g. `map`/`filter`/`enumerate`. Narrower
 * than "has `Symbol.iterator`/`Symbol.asyncIterator`": a plain domain
 * object (such as `SourceDocument`, which exposes `Symbol.asyncIterator`
 * for downstream stream consumption while remaining a regular record) must
 * not be mistaken for a lazy sequence and drained/replaced.
 */
export function isGenerator(value: unknown): boolean {
  return (
    value != null &&
    (Object.prototype.isPrototypeOf.call(GeneratorPrototype, value) ||
      Object.prototype.isPrototypeOf.call(AsyncGeneratorPrototype, value))
  );
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
