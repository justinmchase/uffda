import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

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
export const ObjectExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Token" },
            value: { kind: PatternKind.Equal, value: "{" },
          },
        },
        {
          kind: PatternKind.Variable,
          name: "keys",
          pattern: {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Slice,
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  {
                    kind: PatternKind.Variable,
                    name: "k0",
                    pattern: {
                      kind: PatternKind.Reference,
                      name: "ObjectKeyExpression",
                    },
                  },
                  {
                    kind: PatternKind.Variable,
                    name: "k1",
                    pattern: {
                      kind: PatternKind.Slice,
                      pattern: {
                        kind: PatternKind.Projection,
                        pattern: {
                          kind: PatternKind.Then,
                          patterns: [
                            {
                              kind: PatternKind.Object,
                              keys: {
                                type: { kind: PatternKind.Equal, value: "Token" },
                                value: { kind: PatternKind.Equal, value: "," },
                              }
                            },
                            {
                              kind: PatternKind.Variable,
                              name: "k",
                              pattern: {
                                kind: PatternKind.Reference,
                                name: "ObjectKeyExpression",
                              },
                            },
                          ]
                        },
                        expression: {
                          kind: ExpressionKind.Native,
                          fn: ({ k }) => k
                        }
                      }
                    },
                  },
                  {
                    kind: PatternKind.Slice,
                    min: 0,
                    max: 1,
                    pattern: {
                      kind: PatternKind.Object,
                      keys: {
                        type: { kind: PatternKind.Equal, value: "Token" },
                        value: { kind: PatternKind.Equal, value: "," },
                      }
                    }  
                  }
                ],
              }
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ k0, k1 = [] }) => [k0, ...k1].filter(k => k)
            }
          }
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Token" },
            value: { kind: PatternKind.Equal, value: "}" },
          },
        },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ keys }) => ({
        kind: LangExpressionKind.ObjectExpression,
        keys
      }),
    },
  },
};
