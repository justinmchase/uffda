import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

export const ExpressionPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Reference,
    name: LangExpressionKind.LambdaExpression,
  },
};
