import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

export const SpecialReferencePattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangPatternKind.SpecialReferencePattern,
        },
        name: {
          kind: PatternKind.Variable,
          name: "name",
          pattern: { kind: PatternKind.String },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ name }, specials) => specials[name], // todo: make sure this value is a Pattern
    },
  },
};
