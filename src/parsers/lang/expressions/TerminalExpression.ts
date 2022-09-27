import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

export const TerminalExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      {
        kind: PatternKind.Reference,
        name: LangExpressionKind.NumberExpression,
      },
      {
        kind: PatternKind.Reference,
        name: LangExpressionKind.ReferenceExpression,
      },
      {
        kind: PatternKind.Reference,
        name: LangExpressionKind.SpecialReferenceExpression,
      },
      {
        kind: PatternKind.Reference,
        name: LangExpressionKind.ObjectExpression,
      }
    ],
  },
};
