import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";

export const ProjectionPattern: IRulePattern = {
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
              name: "pattern",
              pattern: { kind: PatternKind.Reference, name: "ThenPattern" },
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "-" },
              },
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
              name: "expression",
              pattern: {
                kind: PatternKind.Reference,
                name: LangPatternKind.ExpressionPattern,
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ pattern, expression }) => ({
            kind: LangPatternKind.ProjectionPattern,
            pattern,
            expression,
          }),
        },
      },
      { kind: PatternKind.Reference, name: "ThenPattern" },
    ],
  },
};
