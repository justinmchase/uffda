import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.except", async (t) => {
  await t.step({
    name: "EXCEPT00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "EXCEPT01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("b"),
      kind: MatchKind.Ok,
      value: "b",
    }),
  });

  await t.step({
    name: "EXCEPT02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.Iterable(""),
      kind: MatchKind.Fail,
      done: true,
    }),
  });
});
