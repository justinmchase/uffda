import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { ExpressionPattern } from "../patterns/ExpressionPattern.ts";

export const InvocationExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
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
      name: "InvocationExpression",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: {
              kind: PatternKind.Equal,
              value: LangExpressionKind.InvocationExpression,
            },
            expression: {
              kind: PatternKind.Variable,
              name: "expression",
              pattern: {
                kind: PatternKind.Reference,
                name: "ExpressionPattern",
              },
            },
            arguments: {
              kind: PatternKind.Variable,
              name: "args",
              pattern: {
                kind: PatternKind.Array,
                pattern: {
                  kind: PatternKind.Slice,
                  pattern: {
                    kind: PatternKind.Reference,
                    name: "ExpressionPattern",
                  },
                },
              },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ expression, args }) => ({
            kind: ExpressionKind.Invocation,
            expression,
            args,
          }),
        },
      },
    },
  ],
};
