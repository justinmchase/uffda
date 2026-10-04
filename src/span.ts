import type { Path } from "./mod.ts";
import type { Scope } from "./runtime/scope.ts";
import type { Input } from "./input.ts";

export type Span = {
  start: Path;
  end: Path;
};

export type SourceSpan = {
  start: number;
  end: number;
};

export function spanFrom(start: Scope, end: Scope): Span {
  return {
    start: start.stream.path,
    end: end.stream.path,
  };
}

export function leafOffset(path: Path): number {
  for (let i = path.segments.length - 1; i >= 0; i--) {
    const segment = path.segments[i];
    if (typeof segment === "number") {
      return segment;
    }
  }
  return 0;
}

function point(offset: number): SourceSpan {
  return { start: offset, end: offset };
}

/**
 * The source position between `input` and the item after it: the start of
 * the next item when it has already been read, otherwise the end of the item
 * at `input`, otherwise the start of the stream.
 */
function pointAt(input: Input): SourceSpan {
  const next = input.following?.value;
  if (next) return point(next.origin.start);
  if (input.value) return point(input.value.origin.end);
  return point(input.base);
}

/**
 * The source offset just after `input` (see {@link pointAt}). It depends on
 * which items have been read, so offsets compared with each other should be
 * taken at the same time.
 */
export function sourceOffsetAt(input: Input): number {
  return pointAt(input).start;
}

/**
 * The source span of a Match from `start` to `end`, derived from the origins
 * of the input items it consumed (see
 * `.agents/specifications/runtime/value-provenance.spec.md#root-input`): from
 * the start of the first consumed item to the end of the last. A Match that
 * consumed nothing is a point (see {@link pointAt}).
 */
export function sourceSpanFrom(start: Scope, end: Scope): SourceSpan {
  const from = start.stream;
  const to = end.stream;
  if (to.index <= from.index || !to.value) return pointAt(from);
  const first = from.following?.value ?? to.value;
  return { start: first.origin.start, end: to.value.origin.end };
}
