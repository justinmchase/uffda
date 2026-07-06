import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:lookahead-001 - Lookahead is a zero-width positive assertion", async (t) => {
  await t.step(
    "lookahead succeeds when child succeeds without consuming",
    patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      done: false,
      value: "a",
    }),
  );

  await t.step(
    "lookahead fails when child fails without consuming",
    patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Equal, value: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
