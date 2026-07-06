import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:maybe-001 - Maybe always succeeds and consumes only when child succeeds", async (t) => {
  await t.step(
    "maybe consumes when child succeeds",
    patternTest({
      pattern: {
        kind: PatternKind.Maybe,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "maybe succeeds without consumption when child fails",
    patternTest({
      pattern: {
        kind: PatternKind.Maybe,
        pattern: { kind: PatternKind.Equal, value: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      done: false,
    }),
  );
});
