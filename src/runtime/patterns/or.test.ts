import { awaitableAgreementTest } from "../../test.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit } from "./value_source.ts";
import { assert, assertEquals } from "@std/assert";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import type { Pattern } from "./pattern.ts";
import { unwrap } from "../../wrapped.ts";

await Deno.test("runtime/patterns/or", async (t) => {
  await t.step({
    name: "OR00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [],
      },
      input: Input.Iterable([]),
      kind: MatchKind.Fail,
      done: true,
    }),
  });

  await t.step({
    name: "OR01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OR02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: lit(1) },
          { kind: PatternKind.Equal, value: lit(2) },
        ],
      },
      input: Input.Iterable([2]),
      value: 2,
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OR03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: lit(1) },
          { kind: PatternKind.Equal, value: lit(2) },
        ],
      },
      input: Input.Iterable([3]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "OR04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: lit(1) },
        ],
      },
      input: Input.Iterable([1, 2]),
      value: 1,
      kind: MatchKind.Ok,
      done: false,
    }),
  });

  await t.step({
    name: "OR05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: lit(0) },
            ],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: lit(1) },
              { kind: PatternKind.Equal, value: lit(0) },
            ],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: lit(1) },
              { kind: PatternKind.Equal, value: lit(2) },
              { kind: PatternKind.Equal, value: lit(0) },
            ],
          },
        ],
      },
      input: Input.Iterable([1, 2, 3]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name:
      "OR_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [{ kind: PatternKind.End }, { kind: PatternKind.Any }],
      },
      items: ["a"],
    }),
  });
});

Deno.test("runtime/patterns/or skip", async (t) => {
  await t.step({
    name: "OR_SKIP00 - a skipped chosen branch is skipped",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [{ kind: PatternKind.Fail }, {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Equal, value: lit("a") },
        }],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Skip,
    }),
  });
});

Deno.test("runtime/patterns/or recovery", async (t) => {
  // Recovers "a" "b" over one item.
  const recoverAB: Pattern = {
    kind: PatternKind.Recover,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        { kind: PatternKind.Equal, value: lit("a") },
        { kind: PatternKind.Equal, value: lit("b") },
      ],
    },
    skip: { kind: PatternKind.Any },
  };
  const recovering = (input: string) =>
    Scope.From(Input.Iterable(input)).withRecovery(true);

  await t.step(
    "OR_RECOVER00 - a later clean alternative wins over a recovered one",
    async () => {
      const m = await match({
        kind: PatternKind.Or,
        patterns: [recoverAB, { kind: PatternKind.Equal, value: lit("x") }],
      }, recovering("x"));
      assert(m.kind === MatchKind.Ok);
      assertEquals(unwrap(m.value), "x");
      assertEquals(m.recovered, undefined);
      const [rejected] = m.matches;
      assert(rejected.kind === MatchKind.Fail);
      assertEquals(rejected.pattern, recoverAB);
      assertEquals(rejected.matches[0].kind, MatchKind.Ok);
    },
  );

  await t.step(
    "OR_RECOVER01 - the first recovered alternative wins when none is clean",
    async () => {
      const m = await match({
        kind: PatternKind.Or,
        patterns: [
          recoverAB,
          { kind: PatternKind.Equal, value: lit("y") },
          recoverAB,
        ],
      }, recovering("x"));
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.recovered, true);
      assertEquals(m.matches.map((c) => c.kind), [
        MatchKind.Ok,
        MatchKind.Fail,
        MatchKind.Fail,
      ]);
    },
  );
});
