import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:includes-001 - Includes matches one item contained in its declared value set", async (t) => {
  await t.step(
    "includes succeeds when value is present",
    patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: [lit("x"), lit("y")],
      },
      input: Input.Iterable("x"),
      kind: MatchKind.Ok,
      value: "x",
    }),
  );

  await t.step(
    "includes fails when value is absent",
    patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: [lit("x"), lit("y")],
      },
      input: Input.Iterable("z"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
