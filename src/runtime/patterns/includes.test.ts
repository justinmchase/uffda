import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
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
      input: Input.Iterable("x"),
      value: "x",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "INCLUDES01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: ["x", "y", "z"],
      },
      input: Input.Iterable("y"),
      value: "y",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "INCLUDES02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: ["x", "y", "z"],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
    }),
  });
});
