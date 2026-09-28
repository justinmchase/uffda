import { Type, type } from "@justinmchase/type";
import type { SourceSpan } from "./span.ts";

/**
 * Where a value came from: the Match that produced it, or a root position in
 * the host-supplied input. Only the source spans are read, so any Match
 * satisfies this structurally without being copied.
 */
export type Origin = {
  readonly normalizedSpan: SourceSpan;
  readonly originalSpan: SourceSpan;
};

/**
 * `length` consecutive characters of a string that share one origin. When
 * `linear`, character `k` of the run maps to offset `start + k` of the
 * origin's spans; otherwise every character maps to the whole origin span.
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

/** The raw value of `value`, one level deep. */
export function rawOf(value: unknown): unknown {
  return isWrapped(value) ? value.raw : value;
}

/**
 * The fully raw form of `value`: wrappers are removed at every level of
 * arrays and plain objects. Shared and cyclic structure is preserved.
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
      if (Object.getPrototypeOf(v) !== Object.prototype) return v;
      const cached = seen.get(v);
      if (cached) return cached;
      const out: Record<PropertyKey, unknown> = {};
      seen.set(v, out);
      const record = v as Record<PropertyKey, unknown>;
      for (const key of Reflect.ownKeys(record)) {
        out[key] = unwrapWith(record[key], seen);
      }
      return out;
    }
    default:
      return raw;
  }
}

/** A root origin covering host input offsets `start` to `end`. */
export function rootOrigin(start: number, end: number): Origin {
  const span = { start, end };
  return { normalizedSpan: span, originalSpan: span };
}

function isUnitWidth(span: SourceSpan): boolean {
  return span.end - span.start === 1;
}

/** The character runs of a wrapped string, covering every character. */
export function charRuns(value: Wrapped<string>): readonly CharRun[] {
  if (value.chars) return value.chars;
  const { length } = value.raw;
  if (length === 0) return [];
  const linear = length === 1 && isUnitWidth(value.origin.normalizedSpan) &&
    isUnitWidth(value.origin.originalSpan);
  return [{ length, origin: value.origin, linear }];
}

function offsetSpan(span: SourceSpan, k: number): SourceSpan {
  return { start: span.start + k, end: span.start + k + 1 };
}

/** The origin of character `index` of a wrapped string. */
export function charOrigin(value: Wrapped<string>, index: number): Origin {
  let k = index;
  for (const run of charRuns(value)) {
    if (k < run.length) {
      if (!run.linear || run.length === 1) return run.origin;
      return {
        normalizedSpan: offsetSpan(run.origin.normalizedSpan, k),
        originalSpan: offsetSpan(run.origin.originalSpan, k),
      };
    }
    k -= run.length;
  }
  throw new RangeError(
    `character ${index} is out of range for a string of length ${value.raw.length}`,
  );
}

function contiguous(a: SourceSpan, b: SourceSpan): boolean {
  return a.end === b.start;
}

function mergeable(a: CharRun, b: CharRun): boolean {
  if (a.origin === b.origin && !a.linear && !b.linear) return true;
  return a.linear && b.linear &&
    contiguous(a.origin.normalizedSpan, b.origin.normalizedSpan) &&
    contiguous(a.origin.originalSpan, b.origin.originalSpan);
}

function merge(a: CharRun, b: CharRun): CharRun {
  if (a.origin === b.origin) {
    return { length: a.length + b.length, origin: a.origin, linear: false };
  }
  return {
    length: a.length + b.length,
    linear: true,
    origin: {
      normalizedSpan: {
        start: a.origin.normalizedSpan.start,
        end: b.origin.normalizedSpan.end,
      },
      originalSpan: {
        start: a.origin.originalSpan.start,
        end: b.origin.originalSpan.end,
      },
    },
  };
}

function toWrappedString(value: unknown, origin: Origin): Wrapped<string> {
  const wrapped = wrap(value, origin);
  const [t] = type(wrapped.raw);
  if (t === Type.String) return wrapped as Wrapped<string>;
  return new Wrapped(String(wrapped.raw), wrapped.origin);
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
