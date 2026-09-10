import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:between-001 - Between matches one item within inclusive bounds", async (t) => {
  await t.step(
    "between succeeds on inclusive in-range value",
    patternTest({
      pattern: { kind: PatternKind.Between, left: lit(1), right: lit(3) },
      input: Input.Iterable([2]),
      kind: MatchKind.Ok,
      value: 2,
    }),
  );

  await t.step(
    "between fails on out-of-range value",
    patternTest({
      pattern: { kind: PatternKind.Between, left: lit(1), right: lit(3) },
      input: Input.Iterable([7]),
      kind: MatchKind.Fail,
      done: false,
    }),
  );

  await t.step(
    "open-upper between succeeds at or above left",
    patternTest({
      pattern: { kind: PatternKind.Between, left: lit(2) },
      input: Input.Iterable([2]),
      kind: MatchKind.Ok,
      value: 2,
    }),
  );

  await t.step(
    "open-lower between succeeds at or below right",
    patternTest({
      pattern: { kind: PatternKind.Between, right: lit(2) },
      input: Input.Iterable([2]),
      kind: MatchKind.Ok,
      value: 2,
    }),
  );
});
