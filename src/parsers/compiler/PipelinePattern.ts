import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";

export const PipelinePattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      PipelinePattern: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Projection,
          pattern: {
            kind: PatternKind.Object,
            keys: {
              kind: { kind: PatternKind.Equal, value: "PipelinePattern" },
              left: {
                kind: PatternKind.Variable,
                name: "left",
                pattern: {
                  kind: PatternKind.Reference,
                  name: "PatternExpression",
                },
              },
              right: {
                kind: PatternKind.Variable,
                name: "right",
                pattern: {
                  kind: PatternKind.Reference,
                  name: "PatternExpression",
                },
              },
            },
          },
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ left, right }) => ({
              kind: PatternKind.Pipeline,
              steps: [left, right],
            }),
          },
        },
      },
    },
  },
};