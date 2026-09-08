import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";

export const Prefix: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./atomic.uff",
      names: ["Atomic"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./pattern.uff",
      names: ["Pattern"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/identifier.uff",
      names: ["Identifier"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/number.uff",
      names: ["Number"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Prefix",
      default: true,
    },
  ],
  rules: [
    {
      name: "Not",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "not",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Prefix",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }) => ({ kind: PatternKind.Not, pattern }),
      },
    },
    {
      name: "Maybe",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "maybe",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Prefix",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }) => ({ kind: PatternKind.Maybe, pattern }),
      },
    },
    {
      name: "Lookahead",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "lookahead",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Prefix",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }) => ({ kind: PatternKind.Lookahead, pattern }),
      },
    },
    {
      name: "Into",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "[",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Pattern",
              args: [],
            },
          },
          {
            kind: PatternKind.Equal,
            value: "]",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }) => ({ kind: PatternKind.Into, pattern }),
      },
    },
    {
      name: "Except",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "except",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Prefix",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }) => ({ kind: PatternKind.Except, pattern }),
      },
    },
    {
      name: "Capture",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "name",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Identifier",
              args: [],
            },
          },
          {
            kind: PatternKind.Equal,
            value: ":",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Prefix",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ name, pattern }) => ({
          kind: PatternKind.Variable,
          name,
          pattern,
        }),
      },
    },
    {
      name: "BoundNumber",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Number",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => (_ as { value: number }).value,
      },
    },
    {
      name: "RepetitionRangeTail",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: ".",
          },
          {
            kind: PatternKind.Equal,
            value: ".",
          },
          {
            kind: PatternKind.Variable,
            name: "max",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "BoundNumber",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ max }) => ({
          max: Array.isArray(max) && max.length > 0
            ? max[0] as number
            : undefined,
        }),
      },
    },
    {
      name: "LowerRepetitionBounds",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "min",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "BoundNumber",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "range",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RepetitionRangeTail",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ min, range }) => ({
          min: min as number,
          max: Array.isArray(range) && range.length > 0
            ? (range[0] as { max?: number }).max
            : undefined,
        }),
      },
    },
    {
      name: "UpperRepetitionBounds",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: ".",
          },
          {
            kind: PatternKind.Equal,
            value: ".",
          },
          {
            kind: PatternKind.Variable,
            name: "max",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "BoundNumber",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ max }) => ({ min: 0, max: max as number }),
      },
    },
    {
      name: "RepetitionBounds",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "LowerRepetitionBounds",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "UpperRepetitionBounds",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "Star",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Atomic",
              args: [],
            },
          },
          {
            kind: PatternKind.Equal,
            value: "*",
          },
          {
            kind: PatternKind.Variable,
            name: "bounds",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RepetitionBounds",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern, bounds }) => {
          const repetitionBounds = Array.isArray(bounds) && bounds.length > 0
            ? bounds[0] as { min?: number; max?: number }
            : {};
          for (const [name, value] of Object.entries(repetitionBounds)) {
            if (value != null && (!Number.isInteger(value) || value < 0)) {
              throw new RangeError(
                `repetition ${name} must be a non-negative integer but is ${value}`,
              );
            }
          }
          if (
            repetitionBounds.min != null && repetitionBounds.max != null &&
            repetitionBounds.max < repetitionBounds.min
          ) {
            throw new RangeError(
              `repetition maximum ${repetitionBounds.max} is less than minimum ${repetitionBounds.min}`,
            );
          }
          return {
            kind: PatternKind.Quantifier,
            pattern,
            min: repetitionBounds.min,
            max: repetitionBounds.max,
          };
        },
      },
    },
    {
      name: "Plus",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Atomic",
              args: [],
            },
          },
          { kind: PatternKind.Equal, value: "+" },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }) => ({
          kind: PatternKind.Quantifier,
          pattern,
          min: 1,
          max: undefined,
        }),
      },
    },
    {
      name: "Optional",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Atomic",
              args: [],
            },
          },
          { kind: PatternKind.Equal, value: "?" },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }) => ({ kind: PatternKind.Maybe, pattern }),
      },
    },
    {
      name: "Postfix",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Star",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Plus",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Optional",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Atomic",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "Prefix",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Not",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Maybe",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Lookahead",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Into",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Except",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Capture",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Postfix",
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

export default Prefix;
