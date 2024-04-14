import { Input } from "../../input.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/equal", async (t) => {
  await t.step({
    name: "EQUAL00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Equal,
        value: "a",
      },
      input: Input.From("a"),
      value: "a",
    }),
  });

  await t.step({
    name: "EQUAL00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Equal,
        value: 7,
      },
      input: Input.From([7]),
      value: 7,
    }),
  });

  await t.step({
    name: "EQUAL00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Equal,
        value: 7,
      },
      input: Input.From([11]),
      matched: false,
      done: false,
    }),
  });
});
