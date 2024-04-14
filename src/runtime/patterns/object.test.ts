import { Input } from "../../input.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ValueType } from "./pattern.ts";

await Deno.test("runtime/patterns/object", async (t) => {
  await t.step({
    name: "OBJECT00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Object,
        keys: {},
      },
      input: Input.From([{}]),
      value: {},
    }),
  });

  await t.step({
    name: "OBJECT01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Object,
        keys: {},
      },
      input: Input.From([{ x: "a" }]),
      value: { x: "a" },
    }),
  });

  await t.step({
    name: "OBJECT02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Object,
        keys: {
          x: { kind: PatternKind.Type, type: ValueType.String },
        },
      },
      input: Input.From([{ x: "a" }]),
      value: { x: "a" },
    }),
  });

  await t.step({
    name: "OBJECT03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Object,
        keys: {
          x: { kind: PatternKind.Type, type: ValueType.String },
        },
      },
      input: Input.From([{}]),
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "OBJECT04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Object,
        keys: {
          type: {
            kind: PatternKind.Equal,
            value: "x",
          },
          value: {
            kind: PatternKind.Equal,
            value: "y",
          },
        },
      },
      input: Input.From([{ type: "x", value: "y" }]),
      value: { type: "x", value: "y" },
    }),
  });
});
