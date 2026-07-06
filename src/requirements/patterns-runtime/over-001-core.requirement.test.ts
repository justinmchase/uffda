import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:over-001 - Over traverses keyed values through declared key patterns", async (t) => {
  await t.step(
    "over succeeds for matching key pattern",
    patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {
          x: { kind: PatternKind.Equal, value: "a" },
        },
      },
      input: Input.Iterable([{ x: "a" }]),
      kind: MatchKind.Ok,
      value: { x: "a" },
    }),
  );

  await t.step(
    "over fails when key pattern fails",
    patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {
          x: { kind: PatternKind.Equal, value: "a" },
        },
      },
      input: Input.Iterable([{ x: "b" }]),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
