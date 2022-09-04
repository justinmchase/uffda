import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

// OrPattern
//   = l:OrPattern '|' r:ProjectionPattern -> {
//       kind: LangPattern.OrPattern,
//       left: l,
//       right: r
//     }
//   | ProjectionPattern

export const OrPattern: IRulePattern = {
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
              name: "l",
              pattern: { kind: PatternKind.Reference, name: "OrPattern" },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "|" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "r",
              pattern: {
                kind: PatternKind.Reference,
                name: "ProjectionPattern",
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ l, r }) => ({
            kind: LangPatternKind.OrPattern,
            left: l,
            right: r,
          }),
        },
      },
      { kind: PatternKind.Reference, name: "ProjectionPattern" },
    ],
  },
};
