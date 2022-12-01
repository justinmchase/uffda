import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";

export const NumberExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "NumberExpression",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: {
              kind: PatternKind.Equal,
              value: LangExpressionKind.NumberExpression,
            },
            value: {
              kind: PatternKind.Variable,
              name: "value",
              pattern: { kind: PatternKind.Number },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ value }) => ({
            kind: ExpressionKind.Number,
            value,
          }),
        },
      },
    },
  ],
};
