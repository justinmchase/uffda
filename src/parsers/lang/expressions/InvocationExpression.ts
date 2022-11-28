import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { ArrayExpression } from "./ArrayExpression.ts";
import { ExpressionPattern } from "../patterns/ExpressionPattern.ts";

export const InvocationExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: ArrayExpression,
      moduleUrl: "./ArrayExpression.ts",
      names: ["ArrayExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ExpressionPattern,
      moduleUrl: "../patterns/ExpressionPattern.ts",
      names: ["ExpressionPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "InvocationExpression",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: "(" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "expression",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: LangPatternKind.ExpressionPattern,
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "args",
                  pattern: {
                    kind: PatternKind.Slice,
                    pattern: {
                      kind: PatternKind.Reference,
                      name: LangPatternKind.ExpressionPattern,
                    },
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: ")" },
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ args, expression }) => ({
                kind: LangExpressionKind.InvocationExpression,
                arguments: args,
                expression,
              }),
            },
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.ArrayExpression,
          },
        ],
      },
    },
  ],
};
