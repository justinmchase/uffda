import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";

export const ProjectionPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: "ProjectionPattern" },
        pattern: {
          kind: PatternKind.Variable,
          name: "pattern",
          pattern: { kind: PatternKind.Reference, name: "PatternExpression" },
        },
        expression: {
          kind: PatternKind.Variable,
          name: "expression",
          pattern: {
            kind: PatternKind.Reference,
            name: "SpecialReferencePattern",
          },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ pattern, expression }) => ({
        kind: PatternKind.Projection,
        pattern,
        expression,
      }),
    },
  },
};
