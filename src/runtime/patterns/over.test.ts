import { assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { getRightmostFailure, MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit } from "./value_source.ts";

await Deno.test("runtime/patterns/object", async (t) => {
  await t.step({
    name: "OBJECT00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {},
      },
      input: Input.Iterable([{}]),
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
      input: Input.Iterable([{ x: "a" }]),
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
      input: Input.Iterable([{ x: "a" }]),
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
      input: Input.Iterable([{}]),
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
          type: { kind: PatternKind.Equal, value: lit("x") },
          value: { kind: PatternKind.Equal, value: lit("y") },
        },
      },
      input: Input.Iterable([{ type: "x", value: "y" }]),
      value: { type: "x", value: "y" },
      kind: MatchKind.Ok,
    }),
  });

  await t.step(
    "OBJECT05 preserves the source object property path",
    async () => {
      const result = await match({
        kind: PatternKind.Over,
        keys: {
          x: { kind: PatternKind.Equal, value: lit("expected") },
        },
      }, Scope.From({ x: "actual" }));

      assertEquals(result.kind, MatchKind.Fail);
      if (result.kind === MatchKind.Fail) {
        assertEquals(
          getRightmostFailure(result).span.start.toString(),
          '[0]."x"',
        );
      }
    },
  );
});
