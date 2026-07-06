import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:regexp-001 - RegExp matches one string item against declared regular expression", async (t) => {
  await t.step(
    "regexp succeeds on matching string",
    patternTest({
      pattern: { kind: PatternKind.RegExp, pattern: /^a$/ },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "regexp fails on non-string value",
    patternTest({
      pattern: { kind: PatternKind.RegExp, pattern: /^a$/ },
      input: Input.Iterable([1]),
      kind: MatchKind.Error,
      code: MatchErrorCode.Type,
      message: "expected value to be a string but got number",
      start: Path.From(0),
      end: Path.From(0),
    }),
  );
});
