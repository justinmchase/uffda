import { Input } from "../../mod.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { MatchKind } from "../../match.ts";

await Deno.test("runtime/patterns/end", async (t) => {
  await t.step({
    name: "MAYBE00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Maybe,
        pattern: {
          kind: PatternKind.Equal,
          value: "a",
        },
      },
      input: Input.From("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });

  await t.step({
    name: "MAYBE01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Maybe,
        pattern: {
          kind: PatternKind.Equal,
          value: "a",
        },
      },
      input: Input.From("b"),
      kind: MatchKind.Ok,
      value: undefined,
      done: false,
    }),
  });

  await t.step({
    name: "MAYBE02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Maybe,
            pattern: {
              kind: PatternKind.Equal,
              value: "a",
            },
          },
          {
            kind: PatternKind.Equal,
            value: "b",
          },
        ],
      },
      input: Input.From("b"),
      kind: MatchKind.Ok,
      value: [undefined, "b"],
    }),
  });
});
