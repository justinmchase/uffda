import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { PatternPattern } from "../patterns/PatternPattern.ts";
import { ExpressionPattern } from "../patterns/ExpressionPattern.ts";

export const LambdaExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
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
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: {
              kind: PatternKind.Equal,
              value: LangExpressionKind.LambdaExpression,
            },
            pattern: {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: {
                kind: PatternKind.Reference,
                name: "PatternPattern",
              },
            },
            expression: {
              kind: PatternKind.Variable,
              name: "expression",
              pattern: {
                kind: PatternKind.Reference,
                name: "ExpressionPattern",
              },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ pattern, expression }) => ({
            kind: ExpressionKind.Lambda,
            pattern,
            expression,
          }),
        },
      },
    }
  ]
};
