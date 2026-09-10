export type NormalizedUnit = {
  value: string;
  originalOffsetStart: number;
  originalOffsetEnd: number;
};

/**
 * One normalized source unit with original offsets.
 * Authors write `(normalized_unit value start end)`.
 */
export function normalized_unit(
  value: string,
  originalOffsetStart: number,
  originalOffsetEnd: number,
): NormalizedUnit {
  if (typeof value !== "string") {
    throw new TypeError("normalized_unit expects value to be a string");
  }
  if (
    typeof originalOffsetStart !== "number" ||
    typeof originalOffsetEnd !== "number"
  ) {
    throw new TypeError("normalized_unit expects numeric offsets");
  }
  return { value, originalOffsetStart, originalOffsetEnd };
}

/**
 * Build normalizationMap from unit original spans:
 * [...starts, lastEnd].
 * Authors write `(normalization_map units)`.
 */
export function normalization_map(
  units: ReadonlyArray<{
    originalOffsetStart: number;
    originalOffsetEnd: number;
  }>,
): number[] {
  if (!Array.isArray(units)) {
    throw new TypeError("normalization_map expects an array");
  }
  return [
    ...units.map(({ originalOffsetStart }) => originalOffsetStart),
    units.at(-1)?.originalOffsetEnd ?? 0,
  ];
}
