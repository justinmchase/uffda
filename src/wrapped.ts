import { Type, type } from "@justinmchase/type";
import type { SourceSpan } from "./span.ts";

type Spanned = { readonly originalSpan: SourceSpan };

/**
 * Where a value came from: the source span of the Match that produced it, or
 * a root position in the host-supplied input. An origin is a span only; a
 * Match (which retains its scope and memos) must not be used as one, which
 * `kind?: never` enforces. Use {@link originOf} to take a Match's span.
 */
export type Origin = Readonly<SourceSpan> & { readonly kind?: never };

/** The origin of values produced by `match`: its span, not the Match. */
export function originOf(match: Spanned): Origin {
  return match.originalSpan;
}

/**
 * `length` consecutive characters (code points, the unit strings are
 * iterated in) of a string that share one origin. When
 * `linear`, character `k` of the run maps to offset `start + k` of the
 * origin; otherwise every character maps to the whole origin span.
 */
export type CharRun = {
  readonly length: number;
  readonly origin: Origin;
  readonly linear: boolean;
};

/**
 * A runtime value paired with its origin (see
 * `.agents/specifications/runtime/value-provenance.spec.md`). Containers hold
 * wrapped elements and properties. Strings MAY carry per-character runs;
 * without them every character shares `origin`.
 */
export class Wrapped<T = unknown> {
  constructor(
    public readonly raw: T,
    public readonly origin: Origin,
    public readonly chars?: readonly CharRun[],
  ) {}
}

export function isWrapped(value: unknown): value is Wrapped {
  return value instanceof Wrapped;
}

/** Carries `value` if it is already wrapped, otherwise wraps it at `origin`. */
export function wrap(value: unknown, origin: Origin): Wrapped {
  return isWrapped(value) ? value : new Wrapped(value, origin);
}

/**
 * Carries `value` if it is already wrapped, otherwise wraps it with the origin
 * of `match` (see {@link originOf}).
 */
export function wrapFrom(value: unknown, match: Spanned): Wrapped {
  return isWrapped(value) ? value : new Wrapped(value, originOf(match));
}

/** The raw value of `value`, one level deep. */
export function rawOf<T>(value: T | Wrapped<T>): T;
export function rawOf(value: unknown): unknown;
export function rawOf(value: unknown): unknown {
  return isWrapped(value) ? value.raw : value;
}

/**
 * The fully raw form of `value`: wrappers are removed at every level of
 * arrays and plain objects, and from the items produced by iterating it
 * (iteration hooks of plain objects, and iterators such as generators).
 * Shared and cyclic structure is preserved.
 */
export function unwrap(value: unknown): unknown {
  return unwrapWith(value, new Map());
}

function unwrapWith(value: unknown, seen: Map<unknown, unknown>): unknown {
  const raw = rawOf(value);
  const [t, v] = type(raw);
  switch (t) {
    case Type.Array: {
      const cached = seen.get(v);
      if (cached) return cached;
      const out: unknown[] = [];
      seen.set(v, out);
      for (const item of v as unknown[]) out.push(unwrapWith(item, seen));
      return out;
    }
    case Type.Object: {
      const record = v as Record<PropertyKey, unknown>;
      if (Object.getPrototypeOf(v) !== Object.prototype) {
        return unwrapIterator(record) ?? v;
      }
      const cached = seen.get(v);
      if (cached) return cached;
      const out: Record<PropertyKey, unknown> = {};
      seen.set(v, out);
      for (const key of Reflect.ownKeys(record)) {
        out[key] = unwrapHook(record, key) ?? unwrapWith(record[key], seen);
      }
      return out;
    }
    default:
      return raw;
  }
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return type(value)[0] === Type.Function;
}

/** An iteration hook of `owner` whose iterators yield unwrapped items. */
function unwrapHook(
  owner: Record<PropertyKey, unknown>,
  key: PropertyKey,
): (() => unknown) | undefined {
  const hook = owner[key];
  if (!isFunction(hook)) return undefined;
  switch (key) {
    case Symbol.asyncIterator:
      return () => unwrapAsyncItems(hook.call(owner) as AsyncIterator<unknown>);
    case Symbol.iterator:
      return () => unwrapItems(hook.call(owner) as Iterator<unknown>);
    default:
      return undefined;
  }
}

/** `value`'s remaining items, unwrapped, when `value` is an iterator. */
function unwrapIterator(
  value: Record<PropertyKey, unknown>,
): AsyncGenerator<unknown> | Generator<unknown> | undefined {
  if (!isFunction(value.next)) return undefined;
  if (isFunction(value[Symbol.asyncIterator])) {
    return unwrapAsyncItems(value as unknown as AsyncIterator<unknown>);
  }
  if (isFunction(value[Symbol.iterator])) {
    return unwrapItems(value as unknown as Iterator<unknown>);
  }
  return undefined;
}

async function* unwrapAsyncItems(
  iterator: AsyncIterator<unknown>,
): AsyncGenerator<unknown> {
  for (let r = await iterator.next(); !r.done; r = await iterator.next()) {
    yield unwrap(r.value);
  }
}

function* unwrapItems(iterator: Iterator<unknown>): Generator<unknown> {
  for (let r = iterator.next(); !r.done; r = iterator.next()) {
    yield unwrap(r.value);
  }
}

/**
 * Item `index` (0-based) of the wrapped sequence `source`, wrapped: carried
 * when already wrapped, the character's own origin for a string, otherwise
 * `source`'s origin.
 */
export function wrapItem(
  source: Wrapped,
  item: unknown,
  index: number,
): Wrapped {
  if (isWrapped(item)) return item;
  if (typeof source.raw === "string" && typeof item === "string") {
    return new Wrapped(item, charOrigin(source as Wrapped<string>, index));
  }
  return new Wrapped(item, source.origin);
}

/** Like {@link wrapItem}, but leaves items of a raw `source` unchanged. */
export function carryItem(
  source: unknown,
  item: unknown,
  index: number,
): unknown {
  return isWrapped(source) ? wrapItem(source, item, index) : item;
}

/**
 * `value` with wrappers removed from it and from its own properties or
 * elements, one level only: for tooling that inspects a node's shape without
 * unwrapping its whole subtree.
 */
export function shallow(value: unknown): unknown {
  const raw = rawOf(value);
  const [t, v] = type(raw);
  switch (t) {
    case Type.Array:
      return (v as unknown[]).map(rawOf);
    case Type.Object: {
      if (Object.getPrototypeOf(v) !== Object.prototype) return v;
      const record = v as Record<PropertyKey, unknown>;
      const out: Record<PropertyKey, unknown> = {};
      for (const key of Reflect.ownKeys(record)) out[key] = rawOf(record[key]);
      return out;
    }
    default:
      return raw;
  }
}

/**
 * A root origin covering host input offsets `start` to `end` (by default the
 * single item at `start`).
 */
export function rootOrigin(start: number, end = start + 1): Origin {
  return { start, end };
}

/**
 * A host-supplied value that is itself the root input: a string's characters
 * take their own offsets, anything else is the single item at offset 0.
 */
export function wrapRoot(value: unknown): Wrapped {
  if (isWrapped(value)) return value;
  const [t, v] = type(value);
  if (t !== Type.String) return new Wrapped(value, rootOrigin(0));
  const length = codePoints(v as string);
  const origin = rootOrigin(0, length);
  const chars = length === 0 ? [] : [{ length, origin, linear: true }];
  return new Wrapped(value, origin, chars);
}

function isUnitWidth(span: Origin): boolean {
  return span.end - span.start === 1;
}

function codePoints(text: string): number {
  let count = 0;
  for (const _ of text) count++;
  return count;
}

/** The character runs of a wrapped string, covering every character. */
export function charRuns(value: Wrapped<string>): readonly CharRun[] {
  if (value.chars) return value.chars;
  const length = codePoints(value.raw);
  if (length === 0) return [];
  const linear = length === 1 && isUnitWidth(value.origin);
  return [{ length, origin: value.origin, linear }];
}

const runStarts = new WeakMap<readonly CharRun[], number[]>();

/** The character index each run starts at, plus the total length. */
function startsOf(runs: readonly CharRun[]): number[] {
  let starts = runStarts.get(runs);
  if (!starts) {
    starts = [0];
    for (const run of runs) starts.push(starts[starts.length - 1] + run.length);
    runStarts.set(runs, starts);
  }
  return starts;
}

/** The origin of character (code point) `index` of a wrapped string. */
export function charOrigin(value: Wrapped<string>, index: number): Origin {
  const outOfRange = () =>
    new RangeError(
      `character ${index} is out of range for ${JSON.stringify(value.raw)}`,
    );
  if (!value.chars) {
    if (index < 0 || index >= value.raw.length) throw outOfRange();
    return value.origin;
  }
  const starts = startsOf(value.chars);
  if (index < 0 || index >= starts[starts.length - 1]) throw outOfRange();
  let lo = 0;
  let hi = value.chars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  const run = value.chars[lo];
  if (!run.linear || run.length === 1) return run.origin;
  const start = run.origin.start + index - starts[lo];
  return { start, end: start + 1 };
}

/** The origin of every character (code point) of a wrapped string. */
export function charOrigins(value: Wrapped<string>): Origin[] {
  const origins: Origin[] = [];
  for (let i = 0, n = codePoints(value.raw); i < n; i++) {
    origins.push(charOrigin(value, i));
  }
  return origins;
}

function mergeable(a: CharRun, b: CharRun): boolean {
  if (a.origin === b.origin && !a.linear && !b.linear) return true;
  return a.linear && b.linear && a.origin.end === b.origin.start;
}

function merge(a: CharRun, b: CharRun): CharRun {
  if (a.origin === b.origin) {
    return { length: a.length + b.length, origin: a.origin, linear: false };
  }
  return {
    length: a.length + b.length,
    linear: true,
    origin: { start: a.origin.start, end: b.origin.end },
  };
}

function toWrappedString(value: unknown, origin: Origin): Wrapped<string> {
  const wrapped = wrap(value, origin);
  const [t] = type(wrapped.raw);
  if (t === Type.String) return wrapped as Wrapped<string>;
  return new Wrapped(String(wrapped.raw), wrapped.origin);
}

/**
 * `String.prototype.slice` over a wrapped string (`start`/`end` in UTF-16
 * units), keeping each character's provenance.
 */
export function sliceString(
  value: Wrapped<string>,
  start?: number,
  end?: number,
): Wrapped<string> {
  const { raw } = value;
  const text = raw.slice(start, end);
  const unitStart = start === undefined
    ? 0
    : start < 0
    ? Math.max(raw.length + start, 0)
    : Math.min(start, raw.length);
  let index = codePoints(raw.slice(0, unitStart));
  const chars: Wrapped<string>[] = [];
  for (const char of text) {
    chars.push(new Wrapped(char, charOrigin(value, index++)));
  }
  return concat(chars, value.origin);
}

/**
 * Concatenates strings, keeping each character's provenance. Non-string
 * parts are converted with `String`; unwrapped parts take `origin`. The
 * result's own origin is `origin`, the Match that performed the operation.
 */
export function concat(
  parts: readonly unknown[],
  origin: Origin,
): Wrapped<string> {
  let text = "";
  const runs: CharRun[] = [];
  for (const part of parts) {
    const piece = toWrappedString(part, origin);
    text += piece.raw;
    for (const run of charRuns(piece)) {
      const last = runs[runs.length - 1];
      if (last && mergeable(last, run)) {
        runs[runs.length - 1] = merge(last, run);
      } else runs.push(run);
    }
  }
  return new Wrapped(text, origin, runs);
}
