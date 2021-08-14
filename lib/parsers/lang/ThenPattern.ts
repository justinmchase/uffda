import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

// ThenPattern
//   = left:ThenPattern right:NotPattern -> ({ type: 'ThenPattern', left right })
//   | NotPattern
export const ThenPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Variable,
              name: "left",
              pattern: { kind: PatternKind.Reference, name: "ThenPattern" },
            },
            {
              kind: PatternKind.Variable,
              name: "right",
              pattern: { kind: PatternKind.Reference, name: "MustPattern" },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ left, right }) => ({
            kind: LangPatternKind.ThenPattern,
            left,
            right,
          }),
        },
      },
      { kind: PatternKind.Reference, name: "MustPattern" },
    ],
  },
};
