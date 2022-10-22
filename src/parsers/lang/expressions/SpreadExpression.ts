import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { TokenizerType } from "../../mod.ts";

export const SpreadExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: TokenizerType.Token },
            value: { kind: PatternKind.Equal, value: "." },
          },
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: TokenizerType.Token },
            value: { kind: PatternKind.Equal, value: "." },
          },
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: TokenizerType.Token },
            value: { kind: PatternKind.Equal, value: "." },
          },
        },
        {
          kind: PatternKind.Variable,
          name: "expression",
          pattern: {
            kind: PatternKind.Reference,
            name: LangPatternKind.ExpressionPattern,
          },
        },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ expression }) => expression,
    },
  },
};
