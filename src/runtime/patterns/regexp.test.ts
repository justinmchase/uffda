import { Input } from "../../input.ts";
import { MatchErrorCode } from "../../match.ts";
import { MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.regexp", async (t) => {
  await t.step({
    name: "REGEXP00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.RegExp,
        pattern: /a/,
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "REGEXP01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.RegExp,
        pattern: /a/,
      },
      input: Input.From([1]),
      kind: MatchKind.Error,
      code: MatchErrorCode.Type,
      message: `expected value to be a string but got number`,
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
  await t.step({
    name: "REGEXP02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.RegExp,
        pattern: /a/,
      },
      input: Input.From("aa"),
      value: "a",
      kind: MatchKind.Ok,
      done: false,
    }),
  });
});
