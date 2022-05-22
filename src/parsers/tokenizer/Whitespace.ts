import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";

export const Whitespace: Pattern = {
  kind: PatternKind.Projection,
  pattern: {
    kind: PatternKind.Slice,
    min: 1,
    pattern: {
      kind: PatternKind.RegExp,
      pattern: /^[^\S\r\n]$/,
    },
  },
  expression: {
    kind: ExpressionKind.Native,
    fn: ({ _ }) => _.join(""),
  },
};
