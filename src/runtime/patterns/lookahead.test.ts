import { awaitableAgreementTest } from "../../test.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit } from "./value_source.ts";
import { assertEquals } from "@std/assert";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";

Deno.test("runtime.patterns.lookahead", async (t) => {
  await t.step({
    name: "LOOKAHEAD00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Equal, value: lit("a") },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
      done: false,
    }),
  });

  await t.step({
    name: "LOOKAHEAD01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Equal, value: lit("a") },
      },
      input: Input.Iterable("b"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "LOOKAHEAD02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.Iterable(""),
      kind: MatchKind.Fail,
      done: true,
    }),
  });

  await t.step({
    name:
      "LOOKAHEAD_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Any },
      },
      items: ["a"],
    }),
  });
});

Deno.test("runtime/patterns/lookahead skip", async (t) => {
  await t.step({
    name: "LOOKAHEAD_SKIP00 - looking ahead at a skip is ordinary",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Equal, value: lit("a") },
        },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: undefined,
      done: false,
    }),
  });
});

Deno.test("runtime/patterns/lookahead recovery", async (t) => {
  await t.step(
    "LOOKAHEAD_RECOVERY - matches its child with recovery disabled",
    async () => {
      const m = await match(
        {
          kind: PatternKind.Lookahead,
          pattern: {
            kind: PatternKind.Recover,
            pattern: { kind: PatternKind.Equal, value: lit("z") },
            skip: { kind: PatternKind.Any },
          },
        },
        Scope.From(Input.Iterable("x")).withRecovery(true),
      );
      assertEquals(m.kind, MatchKind.Fail);
    },
  );
});
