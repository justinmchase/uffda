import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:except-001 - Except is a zero-width negative assertion followed by one-item consumption", async (t) => {
  await t.step(
    "except succeeds and consumes one item when child fails",
    patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "except fails without consumption when child succeeds",
    patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
