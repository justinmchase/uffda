import { Input } from "../../input.ts";
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
      matched: false,
      done: false,
      errors: [
        {
          pattern: { kind: PatternKind.RegExp, pattern: /a/ },
          span: {
            start: Path.From(0),
            end: Path.From(0),
          },
        },
      ],
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
      done: false,
    }),
  });
});
