import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";

export const InvalidPatternDeclaration: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Until,
      name: "InvalidPatternDeclaration",
      message:
        "A pattern declaration was expected and should be in the form of [A = B;]",
      pattern: {
        kind: PatternKind.Object,
        keys: {
          type: { kind: PatternKind.Equal, value: "Token" },
          value: { kind: PatternKind.Equal, value: ";" },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: () => (undefined),
    },
  },
};
