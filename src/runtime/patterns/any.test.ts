import { Input } from "../../input.ts";
import { Path } from "../../path.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/any", async (t) => {
  await t.step({
    name: "ANY00",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.From("a"),
      value: "a",
    }),
  });

  await t.step({
    name: "ANY01",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.From(["a"]),
      value: "a",
    }),
  });

  await t.step({
    name: "ANY02",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.From(""),
      matched: false,
      errors: [
        {
          pattern: { kind: PatternKind.Any },
          span: {
            start: Path.From(0),
            end: Path.From(0),
          },
        },
      ],
    }),
  });

  await t.step({
    name: "ANY03",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.From("ab"),
      value: "a",
      done: false,
      errors: [],
    }),
  });
});
