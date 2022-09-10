import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { TokenizerType } from "../../mod.ts";

export const NumberExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        type: { kind: PatternKind.Equal, value: TokenizerType.Integer },
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
        kind: LangExpressionKind.NumberExpression,
        value,
      }),
    },
  },
};
