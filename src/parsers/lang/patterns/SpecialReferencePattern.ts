import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";

export const SpecialReferencePattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        type: { kind: PatternKind.Equal, value: "SpecialIdentifier" },
        value: {
          kind: PatternKind.Variable,
          name: "name",
          pattern: { kind: PatternKind.String },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ name }) => ({
        kind: LangPatternKind.SpecialReferencePattern,
        name,
      }),
    },
  },
};
