import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { SubtractExpression } from "./SubtractExpression.ts"; 
import { PatternPattern } from "../patterns/PatternPattern.ts"; 
import { ExpressionPattern } from "../patterns/ExpressionPattern.ts"; 

export const LambdaExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => SubtractExpression,
      moduleUrl: "./SubtractExpression.ts",
      names: ["SubtractExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternPattern,
      moduleUrl: "../patterns/PatternPattern.ts",
      names: ["PatternPattern"],
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
      name: "LambdaExpression",
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
                  name: "pattern",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: LangPatternKind.PatternPattern,
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: "-" },
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: ">" },
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
              fn: ({ pattern, expression }) => ({
                kind: LangExpressionKind.LambdaExpression,
                pattern,
                expression,
              }),
            },
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.SubtractExpression,
          },
        ],
      },
    }
  ]
};
