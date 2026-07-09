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
      moduleUrl: "./atomic.ts",
      names: ["Atomic"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./pattern.ts",
      names: ["Pattern"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/identifier.ts",
      names: ["Identifier"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/number.ts",
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
      name: "Variable",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "variable",
          },
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
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Atomic",
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
      name: "Quantifier",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "quantifier",
          },
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
            kind: PatternKind.Variable,
            name: "bounds",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "QuantifierBounds",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern, bounds }) => {
          const quantifierBounds = Array.isArray(bounds) && bounds.length > 0
            ? bounds[0] as { min?: number; max?: number }
            : undefined;
          return {
            kind: PatternKind.Quantifier,
            pattern,
            min: quantifierBounds?.min,
            max: quantifierBounds?.max,
          };
        },
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
      name: "QuantifierBounds",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "(",
          },
          {
            kind: PatternKind.Variable,
            name: "min",
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
          {
            kind: PatternKind.Equal,
            value: ",",
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
          {
            kind: PatternKind.Equal,
            value: ")",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ min, max }) => ({
          min: Array.isArray(min) && min.length > 0
            ? min[0] as number
            : undefined,
          max: Array.isArray(max) && max.length > 0
            ? max[0] as number
            : undefined,
        }),
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
            name: "Variable",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Quantifier",
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
  ],
};

export default Prefix;
