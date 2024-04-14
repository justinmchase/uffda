import { Input } from "../../mod.ts";
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
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "AND04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.RegExp, pattern: /b/ },
          { kind: PatternKind.RegExp, pattern: /a/ },
        ],
      },
      input: Input.From("a"),
      matched: false,
      done: false,
    }),
  });
});
