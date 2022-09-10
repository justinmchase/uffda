import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

export const InvocationExpression: IRulePattern = {
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
              name: "expression",
              pattern: {
                kind: PatternKind.Reference,
                name: "ExpressionPattern",
              },
            },
            {
              kind: PatternKind.Variable,
              name: "args",
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
                value: { kind: PatternKind.Equal, value: ")" },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ args, expression }) => ({
            kind: LangExpressionKind.InvocationExpression,
            arguments: args,
            expression,
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
