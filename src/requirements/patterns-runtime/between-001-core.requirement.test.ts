import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:between-001 - Between matches one item within inclusive bounds", async (t) => {
  await t.step(
    "between succeeds on inclusive in-range value",
    patternTest({
      pattern: { kind: PatternKind.Between, left: 1, right: 3 },
      input: Input.Iterable([2]),
      kind: MatchKind.Ok,
      value: 2,
    }),
  );

  await t.step(
    "between fails on out-of-range value",
    patternTest({
      pattern: { kind: PatternKind.Between, left: 1, right: 3 },
      input: Input.Iterable([7]),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
