import { patternTest, ruleTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { MatchErrorCode } from "../../match.ts";
import { Path } from "../../mod.ts";

Deno.test("runtime.patterns.variable", async (t) => {
  await t.step({
    name: "VARIABLE00",
    fn: ruleTest({
      // P = x:any -> x + 11
      rule: {
        name: "P",
        parameters: [],
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
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "VARIABLE01",
    fn: ruleTest({
      // P = x:any y:any -> x + y
      rule: {
        name: "P",
        parameters: [],
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
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "VARIABLE02",
    fn: ruleTest({
      rule: {
        name: "P",
        parameters: [],
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
      kind: MatchKind.Ok,
    }),
  });

  // Variables declared in object property patterns
  // should be available in the rest of the scope
  await t.step({
    name: "VARIABLE03",
    fn: ruleTest({
      rule: {
        name: "P",
        parameters: [],
        pattern: {
          kind: PatternKind.Object,
          keys: {
            X: {
              kind: PatternKind.Into,
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
              kind: PatternKind.Into,
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
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "VARIABLE05",
    fn: patternTest({
      input: Input.From([1, 2]),
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
      kind: MatchKind.Error,
      code: MatchErrorCode.DuplicateVariable,
      message: "Variable x already exists in scope",
      start: Path.From(1),
      end: Path.From(1),
    }),
  });
});
