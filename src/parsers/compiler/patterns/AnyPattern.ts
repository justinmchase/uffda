import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

export const AnyPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: LangPatternKind.AnyPattern,
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: () => ({
        kind: PatternKind.Any,
      }),
    },
  },
};
