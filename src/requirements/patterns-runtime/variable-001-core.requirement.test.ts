import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:variable-001 - Variable binds child output under declared variable name", async (t) => {
  await t.step(
    "variable binds value on child success",
    patternTest({
      pattern: {
        kind: PatternKind.Variable,
        name: "X",
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "variable fails without binding when child fails",
    patternTest({
      pattern: {
        kind: PatternKind.Variable,
        name: "X",
        pattern: { kind: PatternKind.Equal, value: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
