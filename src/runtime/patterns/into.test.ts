import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/array", async (t) => {
  await t.step({
    name: "ARRAY00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Not,
          pattern: { kind: PatternKind.Any },
        },
      },
      input: Input.From([[]]),
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "ARRAY01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.From([["a"]]),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "ARRAY02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
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
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "ARRAY03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Slice,
          pattern: { kind: PatternKind.Any },
        },
      },
      input: Input.From([["a", "b"]]),
      value: ["a", "b"],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "ARRAY04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.From([["a", "b"]]),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "ARRAY05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Into,
          pattern: { kind: PatternKind.Any },
        },
      },
      input: Input.From([[["a"]]]),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "ARRAY06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Any },
          ],
        },
      },
      input: Input.From([["a"], "b"]),
      kind: MatchKind.Fail,
    }),
  });

  await t.step({
    name: "ARRAY07",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.Type, type: Type.String },
          {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                { kind: PatternKind.Type, type: Type.String },
                { kind: PatternKind.Type, type: Type.String },
                { kind: PatternKind.Type, type: Type.String },
              ],
            },
          },
        ],
      },
      input: Input.From(["abc"]),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
    }),
  });

  // P = [string, string, string]
  await t.step({
    name: "ARRAY09",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Type, type: Type.String },
            { kind: PatternKind.Type, type: Type.String },
            { kind: PatternKind.Type, type: Type.String },
          ],
        },
      },
      input: Input.From([["a", "b", 3]]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
});
