import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { Letter } from "./Letter.ts";
import { Digit } from "./Digit.ts";

// Identifier = '$' (Digit | Character)+
export const SpecialIdentifier: Pattern = {
  kind: PatternKind.Projection,
  pattern: {
    kind: PatternKind.Then,
    patterns: [
      { kind: PatternKind.Equal, value: "$" },
      {
        kind: PatternKind.Variable,
        name: "value",
        pattern: {
          kind: PatternKind.Slice,
          min: 1,
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              Digit,
              Letter,
            ],
          },
        },
      },
    ],
  },
  expression: {
    kind: ExpressionKind.Native,
    fn: ({ value }) => "$" + value.join(""),
  },
};
