import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { MatchErrorCode, Path } from "../../mod.ts";

await Deno.test("runtime/patterns/into", async (t) => {
  await t.step({
    name: "INTO00",
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
    name: "INTO01",
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
    name: "INTO02",
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
    name: "INTO03",
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
    name: "INTO04",
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
    name: "INTO05",
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
    name: "INTO06",
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
    name: "INTO07",
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
    name: "INTO09",
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

  await t.step({
    name: "INTO10",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Any
        },
      },
      input: Input.From([null]),
      kind: MatchKind.Error,
      message: "expected value to be iterable but got type null",
      code: MatchErrorCode.IterableExpected,
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
});
