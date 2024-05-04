import { Input } from "../../mod.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { MatchKind } from "../../match.ts";

await Deno.test("runtime/patterns/end", async (t) => {
  await t.step({
    name: "END00",
    fn: patternTest({
      pattern: { kind: PatternKind.End },
      input: Input.From([]),
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "END01",
    fn: patternTest({
      pattern: { kind: PatternKind.End },
      input: Input.From("a"),
      kind: MatchKind.Fail,
    }),
  });

  await t.step({
    name: "END02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: {
          kind: PatternKind.End,
        },
      },
      input: Input.From("a"),
      kind: MatchKind.Ok,
      done: false,
    }),
  });

  await t.step({
    name: "END03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.End },
        ],
      },
      input: Input.From("abc"),
      kind: MatchKind.Fail,
    }),
  });

  await t.step({
    name: "END04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.End },
        ],
      },
      input: Input.From("abc"),
      value: ["a", "b", "c", undefined],
      kind: MatchKind.Ok,
    }),
  });
});
