import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

export const ArrayExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "[" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "expressions",
              pattern: {
                kind: PatternKind.Slice,
                pattern: {
                  kind: PatternKind.Or,
                  patterns: [
                    {
                      kind: PatternKind.Projection,
                      pattern: {
                        kind: PatternKind.Reference,
                        name: LangExpressionKind.SpreadExpression,
                      },
                      expression: {
                        kind: ExpressionKind.Native,
                        fn: ({ _ }) => ({
                          kind: LangExpressionKind.ArraySpreadExpression,
                          expression: _,
                        }),
                      },
                    },
                    {
                      kind: PatternKind.Projection,
                      pattern: {
                        kind: PatternKind.Reference,
                        name: LangPatternKind.ExpressionPattern,
                      },
                      expression: {
                        kind: ExpressionKind.Native,
                        fn: ({ _ }) => ({
                          kind: LangExpressionKind.ArrayElementExpression,
                          expression: _,
                        }),
                      },
                    },
                  ],
                },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "]" },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ expressions }) => ({
            kind: LangExpressionKind.ArrayExpression,
            expressions,
          }),
        },
      },
      {
        kind: PatternKind.Reference,
        name: LangExpressionKind.TerminalExpression,
      },
    ],
  },
};
