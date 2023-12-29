// import { tests } from "../../test.ts";
// import { PatternKind } from "./pattern.kind.ts";
// import { ExpressionKind } from "../expressions/mod.ts";

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
    name: "VARIABLE04",
    fn: patternTest({
      input: Input.From(["a", "b", "c", ";"]),
      value: undefined,
      errors: [
        {
          name: "TestError",
          message: "A test error",
          start: "[0]",
          end: "[4]",
        },
      ],
      pattern: {
        kind: PatternKind.Variable,
        name: "x",
        pattern: {
          kind: PatternKind.Until,
          name: "TestError",
          message: "A test error",
          pattern: {
            kind: PatternKind.Equal,
            value: ";",
          },
        },
      },
    }),
  });

  await t.step({
    name: "VARIABLE05",
    fn: patternTest({
      input: Input.From([1, 2]),
      matched: false,
      done: false,
      errors: [
        {
          name: "E_VAR_REDECLARE",
          message: "Cannot redeclare variable 'x'",
          start: "[1]",
          end: "[1]",
        },
      ],
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
