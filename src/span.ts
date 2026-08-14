import type { Path } from "./mod.ts";
import type { Scope } from "./runtime/scope.ts";

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

export function mapSourceSpan(
  span: SourceSpan,
  normalizationMap?: readonly number[],
): SourceSpan {
  if (!normalizationMap) {
    return { start: span.start, end: span.end };
  }
  return {
    start: normalizationMap[span.start] ?? span.start,
    end: normalizationMap[span.end] ?? span.end,
  };
}

export function sourceSpansFrom(
  start: Scope,
  end: Scope,
): { normalizedSpan: SourceSpan; originalSpan: SourceSpan } {
  const normalizedSpan = {
    start: leafOffset(start.stream.path),
    end: leafOffset(end.stream.path),
  };
  const map = start.stream.provenance?.normalizationMap ??
    end.stream.provenance?.normalizationMap;
  return {
    normalizedSpan,
    originalSpan: mapSourceSpan(normalizedSpan, map),
  };
}
