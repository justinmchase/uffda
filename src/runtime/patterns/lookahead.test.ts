import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.lookahead", async (t) => {
  await t.step({
    name: "LOOKAHEAD00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
      done: false,
    }),
  });

  await t.step({
    name: "LOOKAHEAD01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("b"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "LOOKAHEAD02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Lookahead,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.Iterable(""),
      kind: MatchKind.Fail,
      done: true,
    }),
  });
});
