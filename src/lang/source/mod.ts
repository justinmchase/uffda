import { Type } from "@justinmchase/type";
import { MatchKind, type MatchOk } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit, ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { line_starts } from "../../runtime/std/line_starts.ts";
import { match_leaf_offset } from "../../runtime/std/match_leaf_offset.ts";
import {
  normalization_map,
  normalized_unit,
} from "../../runtime/std/normalized_unit.ts";
import {
  source_document,
  type SourceDocument,
} from "../../runtime/std/source_document.ts";
import { type SourceUnit, units } from "../../runtime/std/units.ts";

export type { SourceDocument, SourceUnit };

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

/** @deprecated Prefer std `line_starts`. */
export function buildLineStarts(text: string): number[] {
  return line_starts(text);
}

/** @deprecated Prefer std `units`. */
export function buildUnits(
  text: string,
  lineStarts: number[],
  normalizationMap: number[],
): SourceUnit[] {
  return units(text, lineStarts, normalizationMap);
}

function unitFromMatch(value: string, match: MatchOk): NormalizedUnit {
  return normalized_unit(
    value,
    match_leaf_offset(match, "start"),
    match_leaf_offset(match, "end"),
  );
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
          { kind: PatternKind.Equal, value: lit("\r") },
          { kind: PatternKind.Equal, value: lit("\n") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: (_variables, _capabilities, match): NormalizedUnit =>
          unitFromMatch("\n", match),
      },
    },
    {
      name: "CrUnit",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("\r") },
      expression: {
        kind: ExpressionKind.Native,
        fn: (_variables, _capabilities, match): NormalizedUnit =>
          unitFromMatch("\n", match),
      },
    },
    {
      name: "SourceUnit",
      parameters: [],
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: lit("\r") },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }, _capabilities, match): NormalizedUnit =>
          unitFromMatch(_ as string, match),
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
              min: lit(0),
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
          const unitList = _ as NormalizedUnit[];
          return {
            kind: "NormalizedText",
            text: unitList.map(({ value }) => value).join(""),
            normalizationMap: normalization_map(unitList),
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
          kind: { kind: PatternKind.Equal, value: lit("NormalizedText") },
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
            lineStarts: line_starts(normalized.text),
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
          kind: { kind: PatternKind.Equal, value: lit("LineIndex") },
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
            units: units(
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
          kind: { kind: PatternKind.Equal, value: lit("UnitIndex") },
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
          return source_document(
            indexed.text,
            indexed.lineStarts,
            indexed.units,
            indexed.normalizationMap,
          );
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
