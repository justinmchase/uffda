import { Type } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";

export const Structure: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/identifier.ts",
      names: ["Identifier"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./pattern.ts",
      names: ["Pattern"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Structure",
      default: true,
    },
  ],
  rules: [
    {
      name: "Group",
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
            value: ")",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern }) => pattern as Pattern,
      },
    },
    {
      name: "OverEntry",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "name",
            pattern: {
              kind: PatternKind.And,
              patterns: [
                {
                  kind: PatternKind.Type,
                  type: Type.String,
                },
                {
                  kind: PatternKind.Into,
                  pattern: {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "Identifier",
                    args: [],
                  },
                },
              ],
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
              name: "Pattern",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ name, pattern }) => ({ name, pattern }),
      },
    },
    {
      name: "OverEntryTail",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: ",",
          },
          {
            kind: PatternKind.Variable,
            name: "entry",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "OverEntry",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ entry }) => entry,
      },
    },
    {
      name: "OverEntries",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "first",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "OverEntry",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "rest",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "OverEntryTail",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ first, rest }) => [first, ...rest],
      },
    },
    {
      name: "OverEntriesWithTrailing",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "entries",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "OverEntries",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "trailing",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Equal,
                value: ",",
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ entries }) => entries,
      },
    },
    {
      name: "Over",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "{",
          },
          {
            kind: PatternKind.Variable,
            name: "keys",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "OverEntriesWithTrailing",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: "}",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ keys }) => ({
          kind: PatternKind.Over,
          keys: keys.length > 0
            ? Object.fromEntries(
              (keys[0] as { name: string; pattern: Pattern }[]).map((
                entry,
              ) => [entry.name, entry.pattern]),
            )
            : undefined,
        }),
      },
    },
    {
      name: "Structure",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Group",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Over",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _ as Pattern,
      },
    },
  ],
};

export default Structure;
