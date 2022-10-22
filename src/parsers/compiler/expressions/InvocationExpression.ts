import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

export const InvocationExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangExpressionKind.InvocationExpression,
        },
        expression: {
          kind: PatternKind.Variable,
          name: "expression",
          pattern: {
            kind: PatternKind.Reference,
            name: "ExpressionPattern",
          },
        },
        arguments: {
          kind: PatternKind.Variable,
          name: "args",
          pattern: {
            kind: PatternKind.Array,
            pattern: {
              kind: PatternKind.Slice,
              pattern: {
                kind: PatternKind.Reference,
                name: "ExpressionPattern",
              }
            }
          },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ expression, args }) => ({
        kind: ExpressionKind.Invocation,
        expression,
        args,
      }),
    },
  },
};
