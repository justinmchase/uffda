import { Pattern, IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";

export const OneOrMorePattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: "OneOrMorePattern" },
        pattern: {
          kind: PatternKind.Variable,
          name: "pattern",
          pattern: { kind: PatternKind.Reference, name: "PatternExpression" },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ pattern }: { pattern: Pattern }) => ({
        kind: PatternKind.Slice,
        min: 1,
        pattern,
      }),
    },
  },
};
