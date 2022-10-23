import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

export const NumberExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangExpressionKind.NumberExpression,
        },
        value: {
          kind: PatternKind.Variable,
          name: "value",
          pattern: { kind: PatternKind.Number },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ value }) => ({
        kind: ExpressionKind.Value,
        value,
      }),
    },
  },
};
