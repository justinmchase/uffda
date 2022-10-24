import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

export const LambdaExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangExpressionKind.LambdaExpression,
        },
        pattern: {
          kind: PatternKind.Variable,
          name: "pattern",
          pattern: {
            kind: PatternKind.Reference,
            name: "PatternPattern",
          },
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
      fn: ({ pattern, expression }) => ({
        kind: ExpressionKind.Lambda,
        pattern,
        expression,
      }),
    },
  },
};
