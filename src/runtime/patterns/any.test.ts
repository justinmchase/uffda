import { Input } from "../../input.ts";
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
    }),
  });

  await t.step({
    name: "ANY03",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.From("ab"),
      value: "a",
      done: false,
    }),
  });
});
