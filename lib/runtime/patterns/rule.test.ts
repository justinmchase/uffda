import { assert } from "../../../deps/std.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";

tests("patterns.rule", () => [
  {
    id: "RULE00",
    description: "can parse a non-recursive rule",
    pattern: () => ({
      kind: PatternKind.Rule,
      pattern: {
        kind: PatternKind.Equal,
        value: "a",
      },
    }),
    input: "a",
    value: "a",
  },
  {
    id: "RULE01",
    description: "non-progressive recursive patterns only match a single item",
    pattern: () => ({
      kind: PatternKind.Block,
      rules: {
        // a = a | 'a'
        a: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              {
                kind: PatternKind.Reference,
                name: "a",
              },
              {
                kind: PatternKind.Equal,
                value: "a",
              },
            ],
          },
        },
      },
    }),
    input: "aa",
    value: "a",
    done: false,
  },
  {
    id: "RULE02",
    description: "lr patterns match multiple items",
    pattern: () => ({
      kind: PatternKind.Block,
      rules: {
        a: {
          kind: PatternKind.Rule,
          name: "a",
          // a = a 'a' | 'a'
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              {
                kind: PatternKind.Then,
                patterns: [
                  { kind: PatternKind.Reference, name: "a" },
                  { kind: PatternKind.Equal, value: "a" },
                ],
              },
              { kind: PatternKind.Equal, value: "a" },
            ],
          },
        },
      },
    }),
    input: "aaa",
    value: [["a", "a"], "a"],
  },
  {
    id: "RULE03",
    description: "indirect left recursion results in an error",
    pattern: () => ({
      kind: PatternKind.Block,
      rules: {
        a: {
          kind: PatternKind.Rule,
          name: "a",
          pattern: {
            kind: PatternKind.Reference,
            name: "b",
          },
        },
        b: {
          kind: PatternKind.Rule,
          name: "b",
          pattern: {
            kind: PatternKind.Reference,
            name: "a",
          },
        },
      },
    }),
    input: "ab",
    matched: false,
    done: false,
  },
  {
    id: "RULE04",
    description: "right recursion is fine",
    pattern: () => ({
      kind: PatternKind.Block,
      rules: {
        // a = 'a' a | 'a'
        a: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              {
                kind: PatternKind.Then,
                patterns: [
                  { kind: PatternKind.Equal, value: "a" },
                  { kind: PatternKind.Reference, name: "a" },
                ],
              },
              { kind: PatternKind.Equal, value: "a" },
            ],
          },
        },
      },
    }),
    input: "aaa",
    value: ["a", ["a", "a"]],
  },
  {
    id: "RULE05",
    description: "upper variables should not be available in lower scopes",
    pattern: () => ({
      kind: PatternKind.Block,
      rules: {
        P0: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Projection,
            pattern: { kind: PatternKind.Any },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ x }) => (assert(x === undefined), true),
            },
          },
        },
        P1: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Then,
            patterns: [
              {
                kind: PatternKind.Variable,
                name: "x",
                pattern: { kind: PatternKind.Any },
              },
              {
                kind: PatternKind.Or,
                patterns: [
                  { kind: PatternKind.Reference, name: "P0" },
                  { kind: PatternKind.Any },
                ],
              },
            ],
          },
        },
      },
    }),
    input: "ab",
    value: ["a", true],
  },
  {
    id: "RULE06",
    description: "lower variables should not be available in upper scope",
    pattern: () => ({
      kind: PatternKind.Block,
      rules: {
        P0: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Variable,
              name: "x",
              pattern: { kind: PatternKind.Any },
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ x }) => (assert(x === "a"), x),
            },
          },
        },
        P1: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Reference,
              name: "P0",
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: (
                { x, _ },
              ) => (assert(x === undefined), _),
            },
          },
        },
      },
    }),
    input: "a",
    value: "a",
  },
  // todo: two identical rules with different native projections should not trigger DLR
]);
