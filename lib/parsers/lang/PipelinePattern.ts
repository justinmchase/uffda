import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

// PipelinePattern
//   = l:PipelinePattern { type: 'Token', value: '>' } r:OrPattern
//   | OrPattern
//
// e.g.
// x > y > z
//
export const PipelinePattern: Pattern = {
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
              pattern: { kind: PatternKind.Reference, name: "PipelinePattern" },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: ">" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "right",
              pattern: { kind: PatternKind.Reference, name: "AndPattern" },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ left, right }) => ({
            kind: LangPatternKind.PipelinePattern,
            left,
            right,
          }),
        },
      },
      { kind: PatternKind.Reference, name: "AndPattern" },
    ],
  },
};
