import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:any-001 - Any consumes exactly one available input item", async (t) => {
  await t.step(
    "any succeeds and consumes one item",
    patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "any fails at end-of-input",
    patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.Iterable(""),
      kind: MatchKind.Fail,
      done: true,
    }),
  );
});
