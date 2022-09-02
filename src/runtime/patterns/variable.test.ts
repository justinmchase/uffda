import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ExpressionKind } from "../expressions/mod.ts";

tests(() => [
  {
    id: "VARIABLE00",
    description: "should be available in projection of same scope",
    // P = x:any -> x + 11
    pattern: () => ({
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Variable,
        name: "x",
        pattern: { kind: PatternKind.Any },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ x }) => x + 11,
      },
    }),
    input: [7],
    value: 18,
  },
  {
    id: "VARIABLE01",
    description:
      "multiple variables should be available in projection of same scope",
    // P = x:any y:any -> x + y
    pattern: () => ({
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "x",
            pattern: {
              kind: PatternKind.Any,
            },
          },
          {
            kind: PatternKind.Variable,
            name: "y",
            pattern: {
              kind: PatternKind.Any,
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ x, y }) => x + y,
      },
    }),
    input: [7, 11],
    value: 18,
  },
  {
    id: "VARIABLE02",
    description: "variables on object keys should be available",
    // P = { x:X, y:Y } -> x + y
    pattern: () => ({
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Object,
        keys: {
          X: {
            kind: PatternKind.Variable,
            name: "x",
            pattern: { kind: PatternKind.Any },
          },
          Y: {
            kind: PatternKind.Variable,
            name: "y",
            pattern: { kind: PatternKind.Any },
          },
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ x, y }) => x + y,
      },
    }),
    input: [{ X: 7, Y: 11 }],
    value: 18,
  },
  {
    id: "VARIABLE03",
    description: "variables in object key pattern should be available",
    // P = { X = [,x], Y = [,y] } -> x + y
    pattern: () => ({
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Object,
        keys: {
          X: {
            kind: PatternKind.Array,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                { kind: PatternKind.Any },
                {
                  kind: PatternKind.Variable,
                  name: "x",
                  pattern: { kind: PatternKind.Any },
                },
              ],
            },
          },
          Y: {
            kind: PatternKind.Array,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                { kind: PatternKind.Any },
                {
                  kind: PatternKind.Variable,
                  name: "y",
                  pattern: { kind: PatternKind.Any },
                },
              ],
            },
          },
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ x, y }) => x + y,
      },
    }),
    input: [{ X: [6, 7], Y: [10, 11] }],
    value: 18,
  },
  // todo: variable name colision should probably be an error
]);
