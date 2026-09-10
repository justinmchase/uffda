import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ValueSourceKind } from "../../runtime/patterns/value_source.ts";

Deno.test("req:equal-006 - Equal resolves contextual value sources", async (t) => {
  await t.step(
    "equal succeeds against a bound variable value source",
    patternTest({
      pattern: {
        kind: PatternKind.Equal,
        value: { kind: ValueSourceKind.Variable, name: "x" },
      },
      variables: new Map([["x", "a"]]),
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  );

  await t.step(
    "equal errors when the value source is unbound",
    patternTest({
      pattern: {
        kind: PatternKind.Equal,
        value: { kind: ValueSourceKind.Variable, name: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.UnknownReference,
      message: "Unknown value reference $x",
      start: Path.From(0),
      end: Path.From(0),
    }),
  );
});
