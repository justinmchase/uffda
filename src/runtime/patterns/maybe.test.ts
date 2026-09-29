import { awaitableAgreementTest } from "../../test.ts";
import { Input } from "../../mod.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit } from "./value_source.ts";
import { MatchKind } from "../../match.ts";

await Deno.test("runtime/patterns/end", async (t) => {
  await t.step({
    name: "MAYBE00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Maybe,
        pattern: { kind: PatternKind.Equal, value: lit("a") },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });

  await t.step({
    name: "MAYBE01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Maybe,
        pattern: { kind: PatternKind.Equal, value: lit("a") },
      },
      input: Input.Iterable("b"),
      kind: MatchKind.Ok,
      value: undefined,
      done: false,
    }),
  });

  await t.step({
    name: "MAYBE02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Maybe,
            pattern: { kind: PatternKind.Equal, value: lit("a") },
          },
          { kind: PatternKind.Equal, value: lit("b") },
        ],
      },
      input: Input.Iterable("b"),
      kind: MatchKind.Ok,
      value: [undefined, "b"],
    }),
  });

  await t.step({
    name:
      "MAYBE_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: { kind: PatternKind.Maybe, pattern: { kind: PatternKind.Any } },
      items: ["a"],
    }),
  });
});

Deno.test("runtime/patterns/maybe skip", async (t) => {
  await t.step({
    name: "MAYBE_SKIP00 - a skipped child is skipped",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Maybe,
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
    name: "MAYBE_SKIP01 - an absent skip is an ordinary undefined",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Maybe,
        pattern: {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Equal, value: lit("a") },
        },
      },
      input: Input.Iterable("b"),
      kind: MatchKind.Ok,
      value: undefined,
      done: false,
    }),
  });
});
