import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";

export const PatternExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      {
        kind: PatternKind.Reference,
        name: "AnyPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "EqualPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "MustPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "ObjectPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "OkPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "OneOrMorePattern",
      },
      {
        kind: PatternKind.Reference,
        name: "OrPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "PipelinePattern",
      },
      {
        kind: PatternKind.Reference,
        name: "ProjectionPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "RangePattern",
      },
      {
        kind: PatternKind.Reference,
        name: "ReferencePattern",
      },
      {
        kind: PatternKind.Reference,
        name: "SpecialReferencePattern",
      },
      {
        kind: PatternKind.Reference,
        name: "StringPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "ThenPattern",
      },
      {
        kind: PatternKind.Reference,
        name: "VariablePattern",
      },
      {
        kind: PatternKind.Reference,
        name: "ZeroOrMorePattern",
      },
      {
        kind: PatternKind.Reference,
        name: "ZeroOrOnePattern",
      },

      // Expressions
      {
        kind: PatternKind.Reference,
        name: "SpecialReferenceExpression",
      },
    ],
  },
};
