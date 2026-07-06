import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("patterns/end", async (t) => {
  await t.step({
    name: "THEN00",
    fn: patternTest({
      pattern: { kind: PatternKind.Then, patterns: [] },
      input: Input.Iterable([]),
      value: [],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "THEN01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [{ kind: PatternKind.Any }],
      },
      input: Input.Iterable("a"),
      value: ["a"],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "THEN02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("ab"),
      value: ["a", "b"],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "THEN03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("abc"),
      value: ["a", "b"],
      kind: MatchKind.Ok,
      done: false,
    }),
  });

  // It deson't fail if at the end
  await t.step({
    name: "THEN04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Ok },
        ],
      },
      input: Input.Iterable([]),
      value: [undefined],
      kind: MatchKind.Ok,
    }),
  });

  // If inner pattern fails it propagates the fail
  await t.step({
    name: "THEN05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
});
