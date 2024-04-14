import { Input } from "../../input.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/or", async (t) => {
  await t.step({
    name: "OR00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [],
      },
      input: Input.From([]),
      matched: false,
    }),
  });

  await t.step({
    name: "OR01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Any },
        ],
      },
      input: Input.From("a"),
      value: "a",
    }),
  });

  await t.step({
    name: "OR02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: 1 },
          { kind: PatternKind.Equal, value: 2 },
        ],
      },
      input: Input.From([2]),
      value: 2,
    }),
  });

  await t.step({
    name: "OR03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: 1 },
          { kind: PatternKind.Equal, value: 2 },
        ],
      },
      input: Input.From([3]),
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "OR04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: 1 },
        ],
      },
      input: Input.From([1, 2]),
      value: 1,
      done: false,
    }),
  });

  await t.step({
    name: "OR05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: 0 },
            ],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: 1 },
              { kind: PatternKind.Equal, value: 0 },
            ],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: 1 },
              { kind: PatternKind.Equal, value: 2 },
              { kind: PatternKind.Equal, value: 0 },
            ],
          },
        ],
      },
      input: Input.From([1, 2, 3]),
      matched: false,
      done: false,
    }),
  });
});
