import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { awaitableAgreementTest, patternTest } from "../../test.ts";
import { ExpressionKind } from "../expressions/expression.kind.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit } from "./value_source.ts";
import { Path } from "../../path.ts";

const a = { kind: PatternKind.Equal, value: lit("a") } as const;

Deno.test("runtime/patterns/skip", async (t) => {
  await t.step({
    name: "SKIP00 - a matching child is skipped",
    fn: patternTest({
      pattern: { kind: PatternKind.Skip, pattern: a },
      input: Input.Iterable("a"),
      kind: MatchKind.Skip,
    }),
  });

  await t.step({
    name: "SKIP01 - a failing child fails without consuming",
    fn: patternTest({
      pattern: { kind: PatternKind.Skip, pattern: a },
      input: Input.Iterable("b"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "SKIP02 - a skipped child is skipped",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Skip,
        pattern: { kind: PatternKind.Skip, pattern: a },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Skip,
    }),
  });

  await t.step({
    name: "SKIP03 - the child's bindings are kept",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Variable, name: "x", pattern: a },
        },
        expression: { kind: ExpressionKind.Reference, name: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });

  await t.step({
    name: "SKIP04 - a child error propagates",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Skip,
        pattern: {
          kind: PatternKind.Quantifier,
          pattern: a,
          min: lit(-1),
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.InvalidArgument,
      message: "min must be 0 or greater but is -1",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name: "SKIP05 - completes synchronously over available input",
    fn: awaitableAgreementTest({
      pattern: { kind: PatternKind.Skip, pattern: a },
      items: ["a"],
    }),
  });
});
