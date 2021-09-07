import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";

export const OkPattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: "OkPattern" },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: () => ({
        kind: PatternKind.Ok,
      }),
    },
  },
};
