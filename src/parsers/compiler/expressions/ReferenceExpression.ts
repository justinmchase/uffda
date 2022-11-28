import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";

export const ReferenceExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ReferenceExpression",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: {
              kind: PatternKind.Equal,
              value: LangExpressionKind.ReferenceExpression,
            },
            name: {
              kind: PatternKind.Variable,
              name: "name",
              pattern: { kind: PatternKind.String },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ name }) => ({
            kind: ExpressionKind.Reference,
            name,
          }),
        },
      },
    },
  ],
};
