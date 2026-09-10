export type SourceUnit = {
  index: number;
  value: string;
  offsetStart: number;
  offsetEnd: number;
  lineStart: number;
  columnStart: number;
  lineEnd: number;
  columnEnd: number;
  originalOffsetStart: number;
  originalOffsetEnd: number;
};

/**
 * Build SourceUnit rows for normalized text.
 * Authors write `(units text lineStarts normalizationMap)`.
 */
export function units(
  text: string,
  lineStarts: number[],
  normalizationMap: number[],
): SourceUnit[] {
  if (typeof text !== "string") {
    throw new TypeError("units expects text to be a string");
  }
  if (!Array.isArray(lineStarts) || !Array.isArray(normalizationMap)) {
    throw new TypeError("units expects lineStarts and normalizationMap arrays");
  }

  const result: SourceUnit[] = [];
  let lineIndex = 0;
  let lineStartOffset = lineStarts[0] ?? 0;
  let column = 1;
  let offset = 0;
  let unitIndex = 0;

  for (const value of text) {
    const width = value.length;

    while (
      lineIndex + 1 < lineStarts.length &&
      lineStarts[lineIndex + 1] <= offset
    ) {
      lineIndex += 1;
      lineStartOffset = lineStarts[lineIndex];
      column = offset - lineStartOffset + 1;
    }

    const offsetStart = offset;
    const offsetEnd = offset + width;
    const lineStart = lineIndex + 1;
    const columnStart = column;
    const lineEnd = lineStart;
    const columnEnd = columnStart + width;

    result.push({
      index: unitIndex,
      value,
      offsetStart,
      offsetEnd,
      lineStart,
      columnStart,
      lineEnd,
      columnEnd,
      originalOffsetStart: normalizationMap[offsetStart],
      originalOffsetEnd: normalizationMap[offsetEnd],
    });

    unitIndex += 1;
    offset = offsetEnd;

    if (value === "\n") {
      lineIndex += 1;
      lineStartOffset = lineStarts[lineIndex] ?? offset;
      column = 1;
    } else {
      column += width;
    }
  }

  return result;
}
