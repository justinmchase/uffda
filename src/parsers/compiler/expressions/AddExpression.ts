import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

export const AddExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangExpressionKind.AddExpression,
        },
        left: {
          kind: PatternKind.Variable,
          name: "left",
          pattern: {
            kind: PatternKind.Reference,
            name: "ExpressionPattern",
          },
        },
        right: {
          kind: PatternKind.Variable,
          name: "right",
          pattern: {
            kind: PatternKind.Reference,
            name: "ExpressionPattern",
          },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ left, right }) => ({
        kind: ExpressionKind.Add,
        left,
        right,
      }),
    },
  },
};
