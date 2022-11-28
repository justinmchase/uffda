import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { TokenizerKind } from "../../mod.ts";
import { AddExpression } from "./AddExpression.ts";

export const SubtractExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: AddExpression,
      moduleUrl: "./AddExpression.ts",
      names: ["AddExpression"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "SubtractExpression",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                {
                  kind: PatternKind.Variable,
                  name: "left",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: LangExpressionKind.SubtractExpression,
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: {
                      kind: PatternKind.Equal,
                      value: TokenizerKind.Token,
                    },
                    value: { kind: PatternKind.Equal, value: "-" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "right",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: LangExpressionKind.AddExpression,
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ left, right }) => ({
                kind: LangExpressionKind.SubtractExpression,
                left,
                right,
              }),
            },
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.AddExpression,
          },
        ],
      },
    },
  ],
};
