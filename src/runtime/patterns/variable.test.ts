import { lit } from "./value_source.ts";
import { awaitableAgreementTest } from "../../test.ts";
import { patternTest, ruleTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { MatchErrorCode } from "../../match.ts";
import { Path } from "../../mod.ts";
import type { Wrapped } from "../../wrapped.ts";

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
          fn: ({ x }: { x: Wrapped<number> }) => x.raw + 11,
        },
      },
      input: Input.Iterable([7]),
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
          fn: ({ x, y }: Record<string, Wrapped<number>>) => x.raw + y.raw,
        },
      },
      input: Input.Iterable([7, 11]),
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
          kind: PatternKind.Over,
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
          fn: ({ x, y }: Record<string, Wrapped<number>>) => x.raw + y.raw,
        },
      },
      input: Input.Iterable([{ X: 7, Y: 11 }]),
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
          kind: PatternKind.Over,
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
          fn: ({ x, y }: Record<string, Wrapped<number>>) => x.raw + y.raw,
        },
      },
      input: Input.Iterable([{ X: [6, 7], Y: [10, 11] }]),
      value: 18,
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "VARIABLE05",
    fn: patternTest({
      input: Input.Iterable([1, 2]),
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

  await t.step({
    name: "VARIABLE06",
    // A binding whose value is undefined is still a binding.
    fn: patternTest({
      input: Input.Iterable([1]),
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "x",
            pattern: { kind: PatternKind.Ok },
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
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name:
      "VARIABLE_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: {
        kind: PatternKind.Variable,
        name: "x",
        pattern: { kind: PatternKind.Any },
      },
      items: ["a"],
    }),
  });
});

Deno.test("runtime/patterns/variable skip", async (t) => {
  await t.step({
    name: "VARIABLE_SKIP00 - capturing a skip is skipped",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Variable,
        name: "x",
        pattern: {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Equal, value: lit("a") },
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Skip,
    }),
  });

  await t.step({
    name: "VARIABLE_SKIP01 - capturing a skip binds undefined",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: {
            kind: PatternKind.Skip,
            pattern: { kind: PatternKind.Equal, value: lit("a") },
          },
        },
        expression: { kind: ExpressionKind.Reference, name: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: undefined,
    }),
  });
});
