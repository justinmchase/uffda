import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:not-001 - Not is a zero-width negative assertion", async (t) => {
  await t.step(
    "not succeeds when child fails",
    patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Equal, value: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      done: false,
    }),
  );

  await t.step(
    "not fails when child succeeds",
    patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
