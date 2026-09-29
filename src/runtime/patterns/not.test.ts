import { lit } from "./value_source.ts";
import { awaitableAgreementTest } from "../../test.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/not", async (t) => {
  await t.step({
    name: "NOT00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Ok },
      },
      input: Input.Iterable([]),
      kind: MatchKind.Fail,
      done: true,
    }),
  });

  await t.step({
    name: "NOT01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Fail },
      },
      input: Input.Iterable([]),
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "NOT02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: {
          kind: PatternKind.Not,
          pattern: { kind: PatternKind.Ok },
        },
      },
      input: Input.Iterable([]),
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "NOT03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Fail },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      done: false,
    }),
  });

  await t.step({
    name:
      "NOT_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: { kind: PatternKind.Not, pattern: { kind: PatternKind.Any } },
      items: ["a"],
    }),
  });
});

Deno.test("runtime/patterns/not skip", async (t) => {
  await t.step({
    name: "NOT_SKIP00 - a skipped child counts as success",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Equal, value: lit("a") },
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
});
