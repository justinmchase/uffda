import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { Input } from "../../input.ts";

Deno.test("runtime.patterns.variable", async (t) => {
  await t.step({
    name: "VARIABLE00",
    fn: patternTest({
      // P = x:any -> x + 11
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: { kind: PatternKind.Any },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ x }: { x: number }) => x + 11,
        },
      },
      input: new Input([7]),
      value: 18,
    }),
  });
  await t.step({
    name: "VARIABLE01",
    fn: patternTest({
      // P = x:any y:any -> x + y
      pattern: {
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
      },
      input: Input.From([7, 11]),
      value: 18,
    }),
  });

  await t.step({
    name: "VARIABLE02",
    fn: patternTest({
      pattern: {
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
      },
      input: Input.From([{ X: 7, Y: 11 }]),
      value: 18,
    }),
  });

  await t.step({
    name: "VARIABLE03",
    fn: patternTest({
      pattern: {
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
      },
      input: Input.From([{ X: [6, 7], Y: [10, 11] }]),
      value: 18,
    }),
  });

  await t.step({
    name: "VARIABLE05",
    fn: patternTest({
      input: Input.From([1, 2]),
      matched: false,
      done: false,
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "x",
            pattern: { kind: PatternKind.Any },
          },
          {
            kind: PatternKind.Variable,
            name: "x",
            pattern: { kind: PatternKind.Any },
          },
        ],
      },
    }),
  });
});
