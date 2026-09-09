import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ValueSourceKind } from "./value_source.ts";

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

  await t.step({
    name: "INCLUDES_VALUE_SOURCE_VARIABLE",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: [
          { kind: ValueSourceKind.Variable, name: "a" },
          { kind: ValueSourceKind.Literal, value: "y" },
        ],
      },
      variables: new Map([["a", "x"]]),
      input: Input.Iterable("x"),
      value: "x",
      kind: MatchKind.Ok,
    }),
  });
});
