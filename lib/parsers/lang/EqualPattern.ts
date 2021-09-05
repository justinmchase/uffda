import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

export const EqualPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        type: { kind: PatternKind.Equal, value: LangPatternKind.EqualPattern },
        value: {
          kind: PatternKind.Variable,
          name: 'value',
          pattern: {
            kind: PatternKind.Any
          }
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ value }) => ({
        kind: LangPatternKind.EqualPattern,
        value
      }),
    },
  },
};
