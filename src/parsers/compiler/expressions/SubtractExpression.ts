import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { BinaryOperation, ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

export const SubtractExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangExpressionKind.SubtractExpression,
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
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Subtract,
        left,
        right,
      }),
    },
  },
};
