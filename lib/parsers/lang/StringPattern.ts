import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

// This matches quoted string literals "abc" and turns them into equality matches for that string literal
export const StringPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        type: { kind: PatternKind.Equal, value: "String" },
        value: {
          kind: PatternKind.Variable,
          name: "value",
          pattern: { kind: PatternKind.String },
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
