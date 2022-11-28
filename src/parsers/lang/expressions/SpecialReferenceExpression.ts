import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";

export const SpecialReferenceExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "SpecialReferenceExpression",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "SpecialIdentifier" },
            value: {
              kind: PatternKind.Variable,
              name: "name",
              pattern: { kind: PatternKind.String },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ name }) => ({
            kind: LangExpressionKind.SpecialReferenceExpression,
            name,
          }),
        },
      },
    },
  ],
};
