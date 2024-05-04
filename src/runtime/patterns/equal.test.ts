import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
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
      kind: MatchKind.Ok,
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
      kind: MatchKind.Ok,
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
      kind: MatchKind.Fail,
      done: false,
    }),
  });
});
