import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

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
                  kind: PatternKind.Reference,
                  name: "ExpressionPattern",
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
        name: "TerminalExpression",
      },
    ],
  },
};
