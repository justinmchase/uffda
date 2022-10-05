import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";

// This matches number literals and turns them into equality matches for that number value
export const NumberPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        type: { kind: PatternKind.Equal, value: "Integer" },
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
        kind: LangPatternKind.EqualPattern,
        value,
      }),
    },
  },
};
