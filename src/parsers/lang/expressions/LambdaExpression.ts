import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

export const LambdaExpression: IRulePattern = {
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
                value: { kind: PatternKind.Equal, value: "(" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: {
                kind: PatternKind.Reference,
                name: LangPatternKind.PatternPattern,
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "-" },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: ">" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "expression",
              pattern: {
                kind: PatternKind.Reference,
                name: LangPatternKind.ExpressionPattern,
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: ")" },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ pattern, expression }) => ({
            kind: LangExpressionKind.LambdaExpression,
            pattern,
            expression,
          }),
        },
      },
      {
        kind: PatternKind.Reference,
        name: LangExpressionKind.SubtractExpression,
      },
    ],
  },
};
