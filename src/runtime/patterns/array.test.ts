import { Input } from "../../input.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ValueType } from "./pattern.ts";

await Deno.test("runtime/patterns/array", async (t) => {
  await t.step({
    name: "ARRAY00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Array,
        pattern: {
          kind: PatternKind.Not,
          pattern: { kind: PatternKind.Any },
        },
      },
      input: Input.From([[]]),
    }),
  });

  await t.step({
    name: "ARRAY01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Array,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.From([["a"]]),
      value: "a",
    }),
  });

  await t.step({
    name: "ARRAY02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Array,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Any },
          ],
        },
      },
      input: Input.From([["a", "b"]]),
      value: ["a", "b"],
    }),
  });

  await t.step({
    name: "ARRAY03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Array,
        pattern: {
          kind: PatternKind.Slice,
          pattern: { kind: PatternKind.Any },
        },
      },
      input: Input.From([["a", "b"]]),
      value: ["a", "b"],
    }),
  });

  await t.step({
    name: "ARRAY04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Array,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.From([["a", "b"]]),
      value: undefined,
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "ARRAY05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Array,
        pattern: {
          kind: PatternKind.Array,
          pattern: { kind: PatternKind.Any },
        },
      },
      input: Input.From([[["a"]]]),
      value: "a",
    }),
  });

  await t.step({
    name: "ARRAY06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Array,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Any },
          ],
        },
      },
      input: Input.From([["a"], "b"]),
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "ARRAY07",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.Type, type: ValueType.String },
          {
            kind: PatternKind.Array,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                { kind: PatternKind.Type, type: ValueType.String },
                { kind: PatternKind.Type, type: ValueType.String },
                { kind: PatternKind.Type, type: ValueType.String },
              ],
            },
          },
        ],
      },
      input: Input.From(["abc"]),
      value: ["a", "b", "c"],
    }),
  });
});
