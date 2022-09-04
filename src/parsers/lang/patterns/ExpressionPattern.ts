import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";

export const ExpressionPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      { kind: PatternKind.Reference, name: "TerminalExpression" },
    ],
  },
};
