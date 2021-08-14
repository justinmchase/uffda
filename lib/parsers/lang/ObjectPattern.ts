import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

export const ObjectPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Token" },
            value: { kind: PatternKind.Equal, value: "{" },
          },
        },
        // keys:(ObjectKeyPattern (',' k:ObjectKeyPattern -> k)*)? ','?
        {
          kind: PatternKind.Variable,
          name: "keys",
          pattern: {
            kind: PatternKind.Slice,
            min: 0,
            max: 1,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                { kind: PatternKind.Reference, name: "ObjectKeyPattern" },
                {
                  kind: PatternKind.Slice,
                  min: 0,
                  pattern: {
                    kind: PatternKind.Projection,
                    pattern: {
                      kind: PatternKind.Then,
                      patterns: [
                        {
                          kind: PatternKind.Object,
                          keys: {
                            type: { kind: PatternKind.Equal, value: "Token" },
                            value: { kind: PatternKind.Equal, value: "," },
                          },
                        },
                        {
                          kind: PatternKind.Variable,
                          name: "k",
                          pattern: {
                            kind: PatternKind.Reference,
                            name: "ObjectKeyPattern",
                          },
                        },
                      ],
                    },
                    expression: {
                      kind: ExpressionKind.Native,
                      fn: ({ k }) => k,
                    },
                  },
                },
                // Optional trailing comma
                {
                  kind: PatternKind.Slice,
                  min: 0,
                  max: 0,
                  pattern: {
                    kind: PatternKind.Object,
                    keys: {
                      type: { kind: PatternKind.Equal, value: "Token" },
                      value: { kind: PatternKind.Equal, value: "," },
                    },
                  },
                },
              ],
            },
          },
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Token" },
            value: { kind: PatternKind.Equal, value: "}" },
          },
        },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ keys: [[k0, k1 = []] = []] = [] }) => ({
        kind: LangPatternKind.ObjectPattern,
        keys: [k0, ...k1].filter((k) => k),
      }),
    },
  },
};
