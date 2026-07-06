import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:end-001 - End succeeds only at end-of-input and never consumes", async (t) => {
  await t.step(
    "end succeeds at end-of-input",
    patternTest({
      pattern: { kind: PatternKind.End },
      input: Input.Iterable([]),
      kind: MatchKind.Ok,
      done: true,
    }),
  );

  await t.step(
    "end fails when input is available",
    patternTest({
      pattern: { kind: PatternKind.End },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
