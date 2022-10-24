import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { TokenizerType } from "../../mod.ts";

export const SubtractExpression: IRulePattern = {
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
              kind: PatternKind.Variable,
              name: "left",
              pattern: {
                kind: PatternKind.Reference,
                name: LangExpressionKind.SubtractExpression,
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: TokenizerType.Token },
                value: { kind: PatternKind.Equal, value: "-" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "right",
              pattern: {
                kind: PatternKind.Reference,
                name: LangExpressionKind.AddExpression,
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ left, right }) => ({
            kind: LangExpressionKind.SubtractExpression,
            left,
            right,
          }),
        },
      },
      {
        kind: PatternKind.Reference,
        name: LangExpressionKind.AddExpression,
      },
    ],
  },
};
