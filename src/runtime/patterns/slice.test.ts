import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.slice", async (t) => {
  await t.step({
    name: "SLICE00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Ok,
        },
      },
      input: Input.From("abc"),
      value: [undefined],
      kind: MatchKind.Ok,
      done: false,
    }),
  });
  await t.step({
    name: "SLICE01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Any,
        },
      },
      input: Input.From(""),
      value: [],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "SLICE02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: { kind: PatternKind.Type, type: Type.String },
      },
      input: Input.From("a"),
      value: ["a"],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "SLICE03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: { kind: PatternKind.Type, type: Type.String },
      },
      input: Input.From("abc"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "SLICE04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Slice,
            pattern: {
              kind: PatternKind.RegExp,
              pattern: /a/,
            },
          },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.From("b"),
      value: [[], "b"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "SLICE05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          {
            kind: PatternKind.Slice,
            pattern: {
              kind: PatternKind.RegExp,
              pattern: /a/,
            },
          },
        ],
      },
      input: Input.From("a"),
      value: ["a", []],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "SLICE06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: { kind: PatternKind.Any },
        min: 1,
      },
      input: Input.From(""),
      kind: MatchKind.Fail,
      done: true,
    }),
  });
  await t.step({
    name: "SLICE07",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: { kind: PatternKind.Ok },
        min: 3,
      },
      input: Input.From("a"),
      value: [undefined, undefined, undefined],
      kind: MatchKind.Ok,
      done: false,
    }),
  });
  await t.step({
    name: "SLICE08",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 1,
      },
      input: Input.From("a"),
      value: ["a"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "SLICE09",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 3,
      },
      input: Input.From("abc"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "SLICE10",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 3,
        max: 3,
      },
      input: Input.From("abc"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "SLICE11",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 3,
        max: 3,
      },
      input: Input.From("ab"),
      kind: MatchKind.Fail,
    }),
  });
  await t.step({
    name: "SLICE12",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 3,
        max: 3,
      },
      input: Input.From("abcd"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
      done: false,
    }),
  });
});
