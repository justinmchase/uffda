import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:into-001 - Into evaluates child pattern against a nested iterable stream", async (t) => {
  await t.step(
    "into succeeds when child consumes full nested stream",
    patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Equal, value: "a" },
            { kind: PatternKind.Equal, value: "b" },
          ],
        },
      },
      input: Input.Iterable([["a", "b"]]),
      kind: MatchKind.Ok,
      value: ["a", "b"],
    }),
  );

  await t.step(
    "into errors on non-iterable current item",
    patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.Iterable([7]),
      kind: MatchKind.Error,
      code: MatchErrorCode.IterableExpected,
      message: "expected value to be iterable but got type number",
      start: Path.From(0),
      end: Path.From(0),
    }),
  );
});
