import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";

export const OkPattern: Pattern = {
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
