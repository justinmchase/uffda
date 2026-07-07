import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:pattern-matching-001 - Pattern matching preserves distinct outcome categories and supports scalar non-string inputs", async (t) => {
  await t.step(
    "ordinary non-match reports fail rather than error",
    patternTest({
      pattern: { kind: PatternKind.Equal, value: "x" },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );

  await t.step(
    "runtime defects report error rather than ordinary failure",
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

  await t.step(
    "scalar non-string values remain matchable as one input item",
    patternTest({
      pattern: { kind: PatternKind.Equal, value: 7 },
      input: Input.Scalar(7),
      kind: MatchKind.Ok,
      value: 7,
      done: true,
    }),
  );
});
