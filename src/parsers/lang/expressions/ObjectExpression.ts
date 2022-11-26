import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { ObjectKeyExpression } from "./ObjectKeyExpression.ts";
import { SpreadExpression } from "./SpreadExpression.ts";

// ObjectExpression
//   = '{'
//   keys:(
//     k0:ObjectKeyExpression
//     k1:(',' k:ObjectKeyExpression -> k)*
//     ','?
//     -> (filter [k0, ...k1] k => k)
//   )
//   '}'
//   -> {
//     kind: 'ObjectExpression'
//     keys
//   }
export const ObjectExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => ObjectKeyExpression,
      moduleUrl: "./ObjectKeyExpression.ts",
      names: ["ObjectKeyExpression"]
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => SpreadExpression,
      moduleUrl: "./SpreadExpression.ts",
      names: ["SpreadExpression"]
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ObjectExpression",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "{" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "keys",
              pattern: {
                kind: PatternKind.Slice,
                pattern: {
                  kind: PatternKind.Projection,
                  pattern: {
                    kind: PatternKind.Then,
                    patterns: [
                      {
                        kind: PatternKind.Variable,
                        name: "k",
                        pattern: {
                          kind: PatternKind.Or,
                          patterns: [
                            {
                              kind: PatternKind.Reference,
                              name: LangExpressionKind.ObjectKeyExpression,
                            },
                            {
                              kind: PatternKind.Projection,
                              pattern: {
                                kind: PatternKind.Reference,
                                name: LangExpressionKind.SpreadExpression,
                              },
                              expression: {
                                kind: ExpressionKind.Native,
                                fn: ({ _ }) => ({
                                  kind: LangExpressionKind.ObjectSpreadExpression,
                                  expression: _,
                                }),
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  expression: {
                    kind: ExpressionKind.Native,
                    fn: ({ k }) => k,
                  },
                },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "}" },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ keys }) => ({
            kind: LangExpressionKind.ObjectExpression,
            keys,
          }),
        },
      },
    }
  ]
};
