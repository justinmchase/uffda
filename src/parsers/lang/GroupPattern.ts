import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";

export const GroupPattern: IRulePattern = {
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
            value: { kind: PatternKind.Equal, value: "(" },
          },
        },
        {
          kind: PatternKind.Variable,
          name: "p",
          pattern: {
            kind: PatternKind.Reference,
            name: "PatternExpression",
          },
        },
        {
          kind: PatternKind.Must,
          name: "TokenExpected",
          message: "Expected token `)`",
          pattern: {
            kind: PatternKind.Object,
            keys: {
              type: { kind: PatternKind.Equal, value: "Token" },
              value: { kind: PatternKind.Equal, value: ")" },
            },
          },
        },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ p }) => p,
    },
  },
};
