import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

export const ReferenceExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
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
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ name }) => ({
        kind: LangExpressionKind.ReferenceExpression,
        name,
      }),
    },
  },
};