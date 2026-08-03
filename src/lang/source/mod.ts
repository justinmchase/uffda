import { Type } from "@justinmchase/type";
import { MatchKind, type MatchOk } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";
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

type NormalizedUnit = {
  value: string;
  originalOffsetStart: number;
  originalOffsetEnd: number;
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

type UnitIndexedInput = {
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

function sourceOffset(match: MatchOk, edge: "start" | "end"): number {
  const offset = match.span[edge].segments.at(-1);
  if (typeof offset !== "number") {
    throw new TypeError(`Expected numeric source ${edge} offset`);
  }
  return offset;
}

function normalizedUnit(value: string, match: MatchOk): NormalizedUnit {
  return {
    value,
    originalOffsetStart: sourceOffset(match, "start"),
    originalOffsetEnd: sourceOffset(match, "end"),
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

export async function normalizeSource(value: string): Promise<SourceDocument> {
  const result = await executeModuleDeclaration(Source, { input: value });
  if (result.kind !== MatchKind.Ok) {
    throw new Error(`Source normalization failed with ${result.kind}`);
  }
  return result.value as SourceDocument;
}

export const Source: ModuleDeclaration = {
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
      name: "Source",
      default: true,
    },
  ],
  rules: [
    {
      name: "CrLfUnit",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "\r",
          },
          {
            kind: PatternKind.Equal,
            value: "\n",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: (_variables, _capabilities, match): NormalizedUnit =>
          normalizedUnit("\n", match),
      },
    },
    {
      name: "CrUnit",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "\r",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: (_variables, _capabilities, match): NormalizedUnit =>
          normalizedUnit("\n", match),
      },
    },
    {
      name: "SourceUnit",
      parameters: [],
      pattern: {
        kind: PatternKind.Except,
        pattern: {
          kind: PatternKind.Equal,
          value: "\r",
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }, _capabilities, match): NormalizedUnit =>
          normalizedUnit(_ as string, match),
      },
    },
    {
      name: "NormalizedUnit",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CrLfUnit",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CrUnit",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "SourceUnit",
            args: [],
          },
        ],
      },
    },
    {
      name: "NormalizedText",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Lookahead,
            pattern: {
              kind: PatternKind.Type,
              type: Type.String,
            },
          },
          {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "NormalizedUnit",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): NormalizedTextStage => {
          const units = _ as NormalizedUnit[];
          return {
            kind: "NormalizedText",
            text: units.map(({ value }) => value).join(""),
            normalizationMap: [
              ...units.map(({ originalOffsetStart }) => originalOffsetStart),
              units.at(-1)?.originalOffsetEnd ?? 0,
            ],
          };
        },
      },
    },
    {
      name: "LineIndex",
      parameters: [],
      pattern: {
        kind: PatternKind.Over,
        keys: {
          kind: {
            kind: PatternKind.Equal,
            value: "NormalizedText",
          },
          text: {
            kind: PatternKind.Type,
            type: Type.String,
          },
          normalizationMap: {
            kind: PatternKind.Type,
            type: Type.Array,
          },
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): LineIndexedResult => {
          const normalized = _ as NormalizedTextStage;

          return {
            kind: "LineIndex",
            text: normalized.text,
            normalizationMap: normalized.normalizationMap,
            lineStarts: buildLineStarts(normalized.text),
          };
        },
      },
    },
    {
      name: "UnitIndex",
      parameters: [],
      pattern: {
        kind: PatternKind.Over,
        keys: {
          kind: {
            kind: PatternKind.Equal,
            value: "LineIndex",
          },
          text: {
            kind: PatternKind.Type,
            type: Type.String,
          },
          normalizationMap: {
            kind: PatternKind.Type,
            type: Type.Array,
          },
          lineStarts: {
            kind: PatternKind.Type,
            type: Type.Array,
          },
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): UnitIndexedResult => {
          const indexed = _ as LineIndexedResult;

          return {
            kind: "UnitIndex",
            text: indexed.text,
            normalizationMap: indexed.normalizationMap,
            lineStarts: indexed.lineStarts,
            units: buildUnits(
              indexed.text,
              indexed.lineStarts,
              indexed.normalizationMap,
            ),
          };
        },
      },
    },
    {
      name: "SourceDocument",
      parameters: [],
      pattern: {
        kind: PatternKind.Over,
        keys: {
          kind: {
            kind: PatternKind.Equal,
            value: "UnitIndex",
          },
          text: {
            kind: PatternKind.Type,
            type: Type.String,
          },
          normalizationMap: {
            kind: PatternKind.Type,
            type: Type.Array,
          },
          lineStarts: {
            kind: PatternKind.Type,
            type: Type.Array,
          },
          units: {
            kind: PatternKind.Type,
            type: Type.Array,
          },
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): SourceDocument => {
          const indexed = _ as UnitIndexedInput;

          const text = indexed.text;
          return {
            documentId: `source:${text.length}:${checksum(text)}`,
            text,
            lineStarts: indexed.lineStarts,
            units: indexed.units,
            normalizationMap: indexed.normalizationMap,
            [Symbol.iterator](): Iterator<string> {
              return text[Symbol.iterator]();
            },
          };
        },
      },
    },
    {
      name: "Source",
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

export default Source;
