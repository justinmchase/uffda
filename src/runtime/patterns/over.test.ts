import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/object", async (t) => {
  await t.step({
    name: "OBJECT00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {},
      },
      input: Input.From([{}]),
      value: {},
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OBJECT01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {},
      },
      input: Input.From([{ x: "a" }]),
      value: { x: "a" },
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OBJECT02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {
          x: { kind: PatternKind.Type, type: Type.String },
        },
      },
      input: Input.From([{ x: "a" }]),
      value: { x: "a" },
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OBJECT03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {
          x: { kind: PatternKind.Type, type: Type.String },
        },
      },
      input: Input.From([{}]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "OBJECT04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
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
      kind: MatchKind.Ok,
    }),
  });
});
