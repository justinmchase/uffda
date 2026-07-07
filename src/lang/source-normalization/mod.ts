import { Type } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";

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

export type SourceDocument = {
  documentId: string;
  text: string;
  lineStarts: number[];
  units: SourceUnit[];
  normalizationMap: number[];
  [Symbol.iterator](): Iterator<string>;
};

type NormalizedTextResult = {
  text: string;
  normalizationMap: number[];
};

type NormalizedTextStage = {
  kind: "NormalizedText";
  text: string;
  normalizationMap: number[];
};

type LineIndexedResult = {
  kind: "LineIndex";
  text: string;
  normalizationMap: number[];
  lineStarts: number[];
};

type UnitIndexedResult = {
  kind: "UnitIndex";
  text: string;
  normalizationMap: number[];
  lineStarts: number[];
  units: SourceUnit[];
};

function checksum(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) +
      (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeText(value: string): NormalizedTextResult {
  let text = "";
  const normalizationMap: number[] = [];

  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch === "\r") {
      if (value[i + 1] === "\n") {
        text += "\n";
        normalizationMap.push(i);
        i += 2;
        continue;
      }

      text += "\n";
      normalizationMap.push(i);
      i += 1;
      continue;
    }

    text += ch;
    normalizationMap.push(i);
    i += 1;
  }

  normalizationMap.push(value.length);

  return {
    text,
    normalizationMap,
  };
}

export function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n" && i + 1 <= text.length) {
      starts.push(i + 1);
    }
  }
  return starts;
}

export function buildUnits(
  text: string,
  lineStarts: number[],
  normalizationMap: number[],
): SourceUnit[] {
  const units: SourceUnit[] = [];

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

    units.push({
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

  return units;
}

export function normalizeSource(value: string): SourceDocument {
  const normalized = normalizeText(value);
  const lineStarts = buildLineStarts(normalized.text);
  const units = buildUnits(
    normalized.text,
    lineStarts,
    normalized.normalizationMap,
  );

  return {
    documentId: `source:${normalized.text.length}:${checksum(normalized.text)}`,
    text: normalized.text,
    lineStarts,
    units,
    normalizationMap: normalized.normalizationMap,
    [Symbol.iterator](): Iterator<string> {
      return normalized.text[Symbol.iterator]();
    },
  };
}

function isNormalizedTextResult(value: unknown): value is NormalizedTextResult {
  return value != null &&
    typeof value === "object" &&
    typeof (value as { text?: unknown }).text === "string";
}

function isLineIndexedResult(value: unknown): value is LineIndexedResult {
  return value != null &&
    typeof value === "object" &&
    (value as { kind?: unknown }).kind === "LineIndex" &&
    Array.isArray((value as { lineStarts?: unknown }).lineStarts);
}

function isUnitIndexedResult(value: unknown): value is UnitIndexedResult {
  return value != null &&
    typeof value === "object" &&
    (value as { kind?: unknown }).kind === "UnitIndex" &&
    Array.isArray((value as { units?: unknown }).units);
}

export const SourceNormalizationAndIndex: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "NormalizedText",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "LineIndex",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "UnitIndex",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "SourceDocument",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "SourceNormalizationAndIndex",
      default: true,
    },
  ],
  rules: [
    {
      name: "NormalizedText",
      parameters: [],
      pattern: {
        kind: PatternKind.Type,
        type: Type.String,
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): NormalizedTextStage => {
          const normalized = normalizeText(_ as string);
          return {
            kind: "NormalizedText",
            ...normalized,
          };
        },
      },
    },
    {
      name: "LineIndex",
      parameters: [],
      pattern: {
        kind: PatternKind.Any,
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): LineIndexedResult => {
          if (!isNormalizedTextResult(_)) {
            throw new TypeError("LineIndex expects normalized text input");
          }

          return {
            kind: "LineIndex",
            text: _.text,
            normalizationMap: _.normalizationMap,
            lineStarts: buildLineStarts(_.text),
          };
        },
      },
    },
    {
      name: "UnitIndex",
      parameters: [],
      pattern: {
        kind: PatternKind.Any,
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): UnitIndexedResult => {
          if (!isLineIndexedResult(_)) {
            throw new TypeError("UnitIndex expects line-indexed input");
          }

          return {
            kind: "UnitIndex",
            text: _.text,
            normalizationMap: _.normalizationMap,
            lineStarts: _.lineStarts,
            units: buildUnits(_.text, _.lineStarts, _.normalizationMap),
          };
        },
      },
    },
    {
      name: "SourceDocument",
      parameters: [],
      pattern: {
        kind: PatternKind.Any,
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): SourceDocument => {
          if (!isUnitIndexedResult(_)) {
            throw new TypeError("SourceDocument expects unit-indexed input");
          }

          const text = _.text;
          return {
            documentId: `source:${text.length}:${checksum(text)}`,
            text,
            lineStarts: _.lineStarts,
            units: _.units,
            normalizationMap: _.normalizationMap,
            [Symbol.iterator](): Iterator<string> {
              return text[Symbol.iterator]();
            },
          };
        },
      },
    },
    {
      name: "SourceNormalizationAndIndex",
      parameters: [],
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "NormalizedText",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "LineIndex",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "UnitIndex",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "SourceDocument",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
  ],
};

export default SourceNormalizationAndIndex;
