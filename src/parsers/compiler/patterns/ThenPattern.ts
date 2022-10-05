import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";

export const ThenPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: "ThenPattern" },
        left: {
          kind: PatternKind.Variable,
          name: "left",
          pattern: { kind: PatternKind.Reference, name: "PatternPattern" },
        },
        right: {
          kind: PatternKind.Variable,
          name: "right",
          pattern: { kind: PatternKind.Reference, name: "PatternPattern" },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ left, right }) => ({
        kind: PatternKind.Then,
        patterns: [left, right],
      }),
    },
  },
};
