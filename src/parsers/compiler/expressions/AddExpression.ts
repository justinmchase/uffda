import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { BinaryOperation, ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { ExpressionPattern } from "../patterns/ExpressionPattern.ts";

export const AddExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => ExpressionPattern,
      moduleUrl: "../patterns/ExpressionPattern.ts",
      names: ["ExpressionPattern"]
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "AddExpression",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: {
              kind: PatternKind.Equal,
              value: LangExpressionKind.AddExpression,
            },
            left: {
              kind: PatternKind.Variable,
              name: "left",
              pattern: {
                kind: PatternKind.Reference,
                name: "ExpressionPattern",
              },
            },
            right: {
              kind: PatternKind.Variable,
              name: "right",
              pattern: {
                kind: PatternKind.Reference,
                name: "ExpressionPattern",
              },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ left, right }) => ({
            kind: ExpressionKind.Binary,
            op: BinaryOperation.Add,
            left,
            right,
          }),
        },
      },
    }
  ]
};
