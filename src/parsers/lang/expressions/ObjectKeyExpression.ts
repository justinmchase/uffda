import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

export const ObjectKeyExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Identifier" },
            value: {
              kind: PatternKind.Variable,
              name: "key",
              pattern: { kind: PatternKind.String },
            },
          },
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Token" },
            value: { kind: PatternKind.Equal, value: "=" },
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
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ key, expression }) => ({
        kind: LangExpressionKind.ObjectKeyExpression,
        key,
        expression
      }),
    },
  },
};
