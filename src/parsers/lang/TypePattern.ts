import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

// This matches quoted string literals "abc" and turns them into equality matches for that string literal
export const TypePattern: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Identifier" },
            value: {
              kind: PatternKind.Equal,
              value: "string",
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => ({
            kind: LangPatternKind.StringPattern,
          }),
        },
      },
      {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Identifier" },
            value: {
              kind: PatternKind.Equal,
              value: "boolean",
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => ({
            kind: LangPatternKind.BooleanPattern,
          }),
        },
      },
    ],
  },
};
