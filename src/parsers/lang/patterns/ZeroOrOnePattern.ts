import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";

export const ZeroOrOnePattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Variable,
          name: "pattern",
          pattern: { kind: PatternKind.Reference, name: "TerminalPattern" },
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Token" },
            value: { kind: PatternKind.Equal, value: "?" },
          },
        },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ pattern }) => ({
        kind: LangPatternKind.ZeroOrOnePattern,
        pattern,
      }),
    },
  },
};
