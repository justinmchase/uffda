import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { TerminalExpression } from "./TerminalExpression.ts";
import { SpreadExpression } from "./SpreadExpression.ts";
import { ExpressionPattern } from "../patterns/ExpressionPattern.ts";

export const ArrayExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: TerminalExpression,
      moduleUrl: "./TerminalExpression.ts",
      names: ["TerminalExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: SpreadExpression,
      moduleUrl: "./SpreadExpression.ts",
      names: ["SpreadExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ExpressionPattern,
      moduleUrl: "./ExpressionPattern.ts",
      names: ["ExpressionPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ArrayExpression",
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
                    value: { kind: PatternKind.Equal, value: "[" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "expressions",
                  pattern: {
                    kind: PatternKind.Slice,
                    pattern: {
                      kind: PatternKind.Or,
                      patterns: [
                        {
                          kind: PatternKind.Projection,
                          pattern: {
                            kind: PatternKind.Reference,
                            name: LangExpressionKind.SpreadExpression,
                          },
                          expression: {
                            kind: ExpressionKind.Native,
                            fn: ({ _ }) => ({
                              kind: LangExpressionKind.ArraySpreadExpression,
                              expression: _,
                            }),
                          },
                        },
                        {
                          kind: PatternKind.Projection,
                          pattern: {
                            kind: PatternKind.Reference,
                            name: LangPatternKind.ExpressionPattern,
                          },
                          expression: {
                            kind: ExpressionKind.Native,
                            fn: ({ _ }) => ({
                              kind: LangExpressionKind.ArrayElementExpression,
                              expression: _,
                            }),
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: "]" },
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ expressions }) => ({
                kind: LangExpressionKind.ArrayExpression,
                expressions,
              }),
            },
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.TerminalExpression,
          },
        ],
      },
    },
  ],
};
