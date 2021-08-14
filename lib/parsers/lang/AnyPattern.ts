import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

export const AnyPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        type: { kind: PatternKind.Equal, value: "Identifier" },
        value: { kind: PatternKind.Equal, value: "any" },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: () => ({
        kind: LangPatternKind.AnyPattern,
      }),
    },
  },
};
