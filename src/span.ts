import type { Path } from "./mod.ts";
import type { Scope } from "./runtime/scope.ts";
import type { SourceProvenance } from "./input.ts";

export type Span = {
  start: Path;
  end: Path;
};

export type SourceSpan = {
  start: number;
  end: number;
};

export type ItemSourceSpan = {
  normalized: SourceSpan;
  original: SourceSpan;
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

/**
 * Input streams use 1-based leaf indices: path leaf 0 is before the first
 * item, leaf k holds the k-th item. `itemSpans` is 0-based.
 */
function spansFromItemTable(
  startIdx: number,
  endIdx: number,
  itemSpans: readonly ItemSourceSpan[],
  startDone: boolean,
  endDone: boolean,
): { normalizedSpan: SourceSpan; originalSpan: SourceSpan } {
  if (itemSpans.length === 0) {
    return {
      normalizedSpan: { start: startIdx, end: endIdx },
      originalSpan: { start: startIdx, end: endIdx },
    };
  }

  const point = (
    normalized: number,
    original: number,
  ): { normalizedSpan: SourceSpan; originalSpan: SourceSpan } => ({
    normalizedSpan: { start: normalized, end: normalized },
    originalSpan: { start: original, end: original },
  });

  const eofPoint = (
    leaf: number,
  ): { normalizedSpan: SourceSpan; originalSpan: SourceSpan } => {
    if (leaf <= 0) {
      const first = itemSpans[0];
      return point(first.normalized.start, first.original.start);
    }
    const item = itemSpans[Math.min(leaf, itemSpans.length) - 1];
    return point(item.normalized.end, item.original.end);
  };

  const itemStart = (
    leaf: number,
  ): { normalized: number; original: number } => {
    if (leaf <= 0) {
      const first = itemSpans[0];
      return {
        normalized: first.normalized.start,
        original: first.original.start,
      };
    }
    const index = leaf - 1;
    if (index >= itemSpans.length) {
      const last = itemSpans[itemSpans.length - 1];
      return { normalized: last.normalized.end, original: last.original.end };
    }
    const item = itemSpans[index];
    return {
      normalized: item.normalized.start,
      original: item.original.start,
    };
  };

  const itemEnd = (
    leaf: number,
    done: boolean,
  ): { normalized: number; original: number } => {
    if (done) {
      const eof = eofPoint(leaf);
      return {
        normalized: eof.normalizedSpan.start,
        original: eof.originalSpan.start,
      };
    }
    if (leaf <= 0) {
      const first = itemSpans[0];
      return {
        normalized: first.normalized.start,
        original: first.original.start,
      };
    }
    const index = leaf - 1;
    if (index >= itemSpans.length) {
      const last = itemSpans[itemSpans.length - 1];
      return { normalized: last.normalized.end, original: last.original.end };
    }
    const item = itemSpans[index];
    return { normalized: item.normalized.end, original: item.original.end };
  };

  if (startDone) {
    return eofPoint(startIdx);
  }

  const start = itemStart(startIdx);
  if (endIdx < startIdx || (endIdx === startIdx && !endDone)) {
    return point(start.normalized, start.original);
  }

  const end = itemEnd(endIdx, endDone);
  return {
    normalizedSpan: { start: start.normalized, end: end.normalized },
    originalSpan: { start: start.original, end: end.original },
  };
}

export function sourceSpansFrom(
  start: Scope,
  end: Scope,
): { normalizedSpan: SourceSpan; originalSpan: SourceSpan } {
  const startIdx = leafOffset(start.stream.path);
  const endIdx = leafOffset(end.stream.path);
  const provenance: SourceProvenance | undefined = start.stream.provenance ??
    end.stream.provenance;

  if (provenance?.itemSpans && provenance.itemSpans.length > 0) {
    return spansFromItemTable(
      startIdx,
      endIdx,
      provenance.itemSpans,
      start.stream.isEof,
      end.stream.isEof,
    );
  }

  const normalizedSpan = { start: startIdx, end: endIdx };
  return {
    normalizedSpan,
    originalSpan: mapSourceSpan(normalizedSpan, provenance?.normalizationMap),
  };
}
