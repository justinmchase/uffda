import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

export const ArrayExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangExpressionKind.ArrayExpression,
        },
        expressions: {
          kind: PatternKind.Variable,
          name: "expressions",
          pattern: {
            kind: PatternKind.Array,
            pattern: {
              kind: PatternKind.Slice,
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Object,
                      keys: {
                        kind: {
                          kind: PatternKind.Equal,
                          value: LangExpressionKind.ArrayElementExpression,
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
                      fn: ({ expression }) => ({
                        kind: ExpressionKind.ArrayElement,
                        expression,
                      }),
                    },
                  },
                  {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Object,
                      keys: {
                        kind: {
                          kind: PatternKind.Equal,
                          value: LangExpressionKind.ArraySpreadExpression,
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
                      fn: ({ expression }) => ({
                        kind: ExpressionKind.ArraySpread,
                        expression,
                      }),
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ expressions }) => ({
        kind: ExpressionKind.Array,
        expressions,
      }),
    },
  },
};
