import { Type } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { StringExpression } from "../../runtime/expressions/mod.ts";

export const String: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./primary.ts",
      names: [
        "Primary",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "String",
      default: true,
    },
  ],
  rules: [
    {
      name: "EscapedDollarParen",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "\\",
          },
          {
            kind: PatternKind.Equal,
            value: "$",
          },
          {
            kind: PatternKind.Equal,
            value: "(",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.String,
        values: ["$("],
      },
    },
    {
      name: "EscapedDoubleQuote",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "\\",
          },
          {
            kind: PatternKind.Equal,
            value: '"',
          },
        ],
      },
      expression: {
        kind: ExpressionKind.String,
        values: ['"'],
      },
    },
    {
      name: "EscapedString",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "EscapedDollarParen",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "EscapedDoubleQuote",
            args: [],
          },
        ],
      },
    },
    {
      name: "StringExpression",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "$",
          },
          {
            kind: PatternKind.Equal,
            value: "(",
          },
          {
            kind: PatternKind.Variable,
            name: "v",
            pattern: {
              kind: PatternKind.Reference,
              name: "Primary", // todo: this should be Expression
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
        fn: ({ v }) => v,
      },
    },
    {
      name: "StringContent",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        min: 1,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Reference,
              name: "EscapedString",
              args: [],
            },
            {
              kind: PatternKind.And,
              patterns: [
                {
                  kind: PatternKind.Not,
                  pattern: {
                    kind: PatternKind.Equal,
                    value: "$",
                  },
                },
                {
                  kind: PatternKind.Not,
                  pattern: {
                    kind: PatternKind.Equal,
                    value: '"',
                  },
                },
                {
                  kind: PatternKind.Type,
                  type: Type.String,
                },
              ],
            },
          ],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _.join(""),
      },
    },
    {
      name: "String",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: '"',
          },
          {
            kind: PatternKind.Variable,
            name: "v",
            pattern: {
              kind: PatternKind.Slice,
              min: 0,
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Reference,
                    name: "StringExpression",
                    args: [],
                  },
                  {
                    kind: PatternKind.Reference,
                    name: "StringContent",
                    args: [],
                  },
                ],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: '"',
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ v }): StringExpression => ({
          kind: ExpressionKind.String,
          values: v,
        }),
      },
    },
  ],
};

export default String;
