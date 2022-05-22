import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang/lang.pattern.ts";

export const OrPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: LangPatternKind.OrPattern },
        left: {
          kind: PatternKind.Variable,
          name: "left",
          pattern: { kind: PatternKind.Reference, name: "PatternExpression" },
        },
        right: {
          kind: PatternKind.Variable,
          name: "right",
          pattern: { kind: PatternKind.Reference, name: "PatternExpression" },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ left, right }) => ({
        kind: PatternKind.Or,
        patterns: [left, right],
      }),
    },
  },
};
