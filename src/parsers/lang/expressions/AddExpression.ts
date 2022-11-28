import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { TokenizerKind } from "../../mod.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { MemberExpression } from "./MemberExpression.ts";

export const AddExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: MemberExpression,
      moduleUrl: "./MemberExpression.ts",
      names: ["MemberExpression"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "AddExpression",
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
                    name: LangExpressionKind.AddExpression,
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: {
                      kind: PatternKind.Equal,
                      value: TokenizerKind.Token,
                    },
                    value: { kind: PatternKind.Equal, value: "+" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "right",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: LangExpressionKind.MemberExpression,
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ left, right }) => ({
                kind: LangExpressionKind.AddExpression,
                left,
                right,
              }),
            },
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.MemberExpression,
          },
        ],
      },
    },
  ],
};
