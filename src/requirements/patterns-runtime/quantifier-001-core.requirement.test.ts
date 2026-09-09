import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:quantifier-001 - Quantifier repeats child pattern within declared bounds with progress guarantees", async (t) => {
  await t.step(
    "quantifier respects min and max bounds",
    patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: { kind: PatternKind.Any },
        min: lit(2),
        max: lit(2),
      },
      input: Input.Iterable("ab"),
      kind: MatchKind.Ok,
      value: ["a", "b"],
    }),
  );

  await t.step(
    "quantifier fails when minimum not met",
    patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: { kind: PatternKind.Equal, value: lit("x") },
        min: lit(1),
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
