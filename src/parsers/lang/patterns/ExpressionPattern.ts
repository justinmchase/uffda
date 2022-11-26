import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { LambdaExpression } from "../expressions/LambdaExpression.ts"

export const ExpressionPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => LambdaExpression,
      moduleUrl: "./LambdaExpression.ts",
      names: ["LambdaExpression"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ExpressionPattern",
      pattern: {
        kind: PatternKind.Reference,
        name: LangExpressionKind.LambdaExpression,
      },
    }
  ]
};
