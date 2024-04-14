import { Input } from "../../input.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/includes", async (t) => {
  await t.step({
    name: "INCLUDES00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: ["x"],
      },
      input: Input.From("x"),
      value: "x",
    }),
  });

  await t.step({
    name: "INCLUDES01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: ["x", "y", "z"],
      },
      input: Input.From("y"),
      value: "y",
    }),
  });

  await t.step({
    name: "INCLUDES02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: ["x", "y", "z"],
      },
      input: Input.From("a"),
      matched: false,
      done: false,
    }),
  });
});
