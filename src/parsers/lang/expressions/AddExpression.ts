import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { TokenizerType } from "../../mod.ts";

export const AddExpression: IRulePattern = {
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
                name: LangExpressionKind.AddExpression,
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: TokenizerType.Token },
                value: { kind: PatternKind.Equal, value: "+" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "right",
              pattern: {
                kind: PatternKind.Reference,
                name: LangExpressionKind.MemberExpression,
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ left, right }) => ({
            kind: LangExpressionKind.AddExpression,
            left,
            right,
          }),
        },
      },
      {
        kind: PatternKind.Reference,
        name: LangExpressionKind.MemberExpression,
      },
    ],
  },
};
