import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { IRulePattern } from "../../runtime/patterns/pattern.ts";

export const PatternModule: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: "PatternModule" },
        patterns: {
          kind: PatternKind.Variable,
          name: "patterns",
          pattern: {
            kind: PatternKind.Array,
            pattern: {
              kind: PatternKind.Slice,
              pattern: {
                kind: PatternKind.Reference,
                name: "PatternDeclaration",
              },
            },
          },
        },
        // imports // todo: implement imports...
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ patterns }) => ({
        kind: PatternKind.Block,
        rules: patterns.reduce(
          (
            a: Record<string, unknown>,
            b: Record<string, unknown>,
          ) => ({
            ...a,
            ...b,
          }),
          {},
        ),
      }),
    },
  },
};
