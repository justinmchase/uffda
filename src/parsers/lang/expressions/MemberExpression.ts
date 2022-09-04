import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

// MemberExpression
//   = expression:MemberExpression '.' name:IdentifierExpression -> {
//       kind: LangExpressionKind.MemberExpression,
//       expression,
//       name,
//     }
//   | TerminalExpression

export const MemberExpression: IRulePattern = {
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
              name: "expression",
              pattern: {
                kind: PatternKind.Reference,
                name: "MemberExpression",
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "." },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Identifier" },
                value: {
                  kind: PatternKind.Variable,
                  name: "name",
                  pattern: { kind: PatternKind.String },
                },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ expression, name }) => ({
            kind: LangExpressionKind.MemberExpression,
            expression,
            name,
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
