/**
 * Awaitable evaluation with a synchronous fast path.
 *
 * Runtime evaluation is async-capable, but most work (matching a string,
 * evaluating a literal) never actually needs to wait on anything. Runtime
 * functions therefore return `Awaitable<T>`: the value itself when it is
 * already available, or a `Promise` only when something genuinely async
 * (an async-iterable input, a native function returning a promise) was
 * involved. Whether a result is awaitable is decided purely by the value a
 * callee returns, never by inspecting patterns or expressions ahead of time.
 *
 * Call sites never branch on promises themselves; each helper below stands
 * in for one familiar construct: {@link andThen} for `await`, {@link attempt}
 * for `try`/`catch`, {@link ensure} for `try`/`finally`, and
 * {@link eachInOrder}/{@link repeatUntil}/{@link mapInOrder} for sequential
 * loops.
 * See `.agents/specifications/runtime.spec.md#synchronous-completion-and-the-rule-boundary`.
 */
import type { Match } from "../match.ts";

export type Awaitable<T> = T | Promise<T>;

export type AwaitableMatch = Awaitable<Match>;

/**
 * Whether `value` is a thenable. Any object with a callable `then` counts,
 * not only native promises, so values `await` would adopt are adopted here
 * too. `@justinmchase/type` has no promise/thenable type to defer to.
 * Thenables are always chained through `Promise.resolve(value)`: a foreign
 * thenable's own `then` need not return a chainable result.
 */
function isPromise<T>(value: Awaitable<T>): value is Promise<T> {
  return typeof (value as { then?: unknown } | null | undefined)?.then ===
    "function";
}

/**
 * `await`: applies `fn` to `value`, immediately when `value` is already
 * available and as a continuation when it is a promise. A rejection skips
 * `fn` and propagates, exactly like a rejected `await` throws.
 */
export function andThen<T, U>(
  value: Awaitable<T>,
  fn: (resolved: T) => Awaitable<U>,
): Awaitable<U> {
  return isPromise(value) ? Promise.resolve(value).then(fn) : fn(value);
}

/**
 * `try`/`catch`: runs `fn`, routing its result to `onValue` and a
 * synchronous throw or an async rejection alike to `onError`.
 */
export function attempt<T, U>(
  fn: () => Awaitable<T>,
  onValue: (value: T) => Awaitable<U>,
  onError: (err: unknown) => Awaitable<U>,
): Awaitable<U> {
  let result: Awaitable<T>;
  try {
    result = fn();
  } catch (err) {
    return onError(err);
  }
  return isPromise(result)
    ? Promise.resolve(result).then(onValue, onError)
    : onValue(result);
}

/**
 * `try`/`finally`: runs `fn`, then `cleanup` once it has completed, thrown
 * or rejected. The result, throw, or rejection is passed through unchanged.
 */
export function ensure<T>(
  fn: () => Awaitable<T>,
  cleanup: () => void,
): Awaitable<T> {
  let result: Awaitable<T>;
  try {
    result = fn();
  } catch (err) {
    cleanup();
    throw err;
  }
  if (isPromise(result)) {
    return Promise.resolve(result).finally(cleanup);
  }
  cleanup();
  return result;
}

/**
 * A sequential `for` loop over `step(0)` … `step(count - 1)`: each step
 * runs only after the previous one has completed. After each step,
 * `settle(i, result)` returns the loop's final value to stop early, or
 * `undefined` to continue; `done()` produces the final value when every
 * step continued.
 *
 * Stays synchronous for as long as steps return immediate values; the first
 * step that returns a promise makes the rest of the loop (and the result)
 * awaitable.
 */
export function eachInOrder<R, T>(
  count: number,
  step: (i: number) => Awaitable<R>,
  settle: (i: number, result: R) => T | undefined,
  done: () => T,
): Awaitable<T> {
  return eachFrom(0, count, step, settle, done);
}

function eachFrom<R, T>(
  start: number,
  count: number,
  step: (i: number) => Awaitable<R>,
  settle: (i: number, result: R) => T | undefined,
  done: () => T,
): Awaitable<T> {
  for (let i = start; i < count; i++) {
    const result = step(i);
    if (isPromise(result)) {
      return Promise.resolve(result).then((resolved) => {
        const settled = settle(i, resolved);
        return settled !== undefined
          ? settled
          : eachFrom(i + 1, count, step, settle, done);
      });
    }
    const settled = settle(i, result);
    if (settled !== undefined) {
      return settled;
    }
  }
  return done();
}

/**
 * A sequential `while (true)` loop: repeats `step()` until `settle(result)`
 * returns the final value instead of `undefined`. Synchronous for as long
 * as steps are, like {@link eachInOrder}.
 */
export function repeatUntil<R, T>(
  step: () => Awaitable<R>,
  settle: (result: R) => T | undefined,
): Awaitable<T> {
  while (true) {
    const result = step();
    if (isPromise(result)) {
      return Promise.resolve(result).then((resolved) => {
        const settled = settle(resolved);
        return settled !== undefined ? settled : repeatUntil(step, settle);
      });
    }
    const settled = settle(result);
    if (settled !== undefined) {
      return settled;
    }
  }
}

/**
 * Maps `items` through `fn` strictly in order, one at a time (each call
 * starts only after the previous result is available).
 */
export function mapInOrder<T, U>(
  items: readonly T[],
  fn: (item: T, index: number) => Awaitable<U>,
): Awaitable<U[]> {
  const results: U[] = [];
  return eachInOrder(
    items.length,
    (i) => fn(items[i], i),
    (_, result) => {
      results.push(result);
      return undefined;
    },
    () => results,
  );
}
