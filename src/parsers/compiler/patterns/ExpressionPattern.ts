import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";

export const ExpressionPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Reference,
    name: "SpecialReferenceExpression", // todo: compile all lang expression types
  },
};
