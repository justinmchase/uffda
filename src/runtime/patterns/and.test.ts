import { Input } from "../../mod.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/and", async (t) => {
  await t.step({
    name: "AND00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.Any },
        ],
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "AND01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "AND02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.And,
            patterns: [
              { kind: PatternKind.Any },
              { kind: PatternKind.Any },
            ],
          },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.From("ab"),
      value: ["a", "b"],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "AND03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.RegExp, pattern: /b/ },
          { kind: PatternKind.RegExp, pattern: /a/ },
        ],
      },
      input: Input.From("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "AND04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.RegExp, pattern: /a/ },
          { kind: PatternKind.RegExp, pattern: /b/ },
        ],
      },
      input: Input.From("b"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "AND05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.RegExp, pattern: /a/ },
          { kind: PatternKind.RegExp, pattern: /b/ },
        ],
      },
      input: Input.From("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
  await t.step({
    name: "AND06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [],
      },
      input: Input.From("a"),
      kind: MatchKind.Ok,
      done: false,
    }),
  });
});
