import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.quantifier", async (t) => {
  await t.step({
    name: "QUANTIFIER00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Ok,
        },
      },
      input: Input.Iterable("abc"),
      value: [undefined],
      kind: MatchKind.Ok,
      done: false,
    }),
  });
  await t.step({
    name: "QUANTIFIER01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Any,
        },
      },
      input: Input.Iterable(""),
      value: [],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "QUANTIFIER02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: { kind: PatternKind.Type, type: Type.String },
      },
      input: Input.Iterable("a"),
      value: ["a"],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "QUANTIFIER03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: { kind: PatternKind.Type, type: Type.String },
      },
      input: Input.Iterable("abc"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "QUANTIFIER04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Quantifier,
            pattern: {
              kind: PatternKind.RegExp,
              pattern: /a/,
            },
          },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("b"),
      value: [[], "b"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "QUANTIFIER05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          {
            kind: PatternKind.Quantifier,
            pattern: {
              kind: PatternKind.RegExp,
              pattern: /a/,
            },
          },
        ],
      },
      input: Input.Iterable("a"),
      value: ["a", []],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "QUANTIFIER06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: { kind: PatternKind.Any },
        min: 1,
      },
      input: Input.Iterable(""),
      kind: MatchKind.Fail,
      done: true,
    }),
  });
  await t.step({
    name: "QUANTIFIER07",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: { kind: PatternKind.Ok },
        min: 3,
      },
      input: Input.Iterable("a"),
      value: [undefined, undefined, undefined],
      kind: MatchKind.Ok,
      done: false,
    }),
  });
  await t.step({
    name: "QUANTIFIER08",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 1,
      },
      input: Input.Iterable("a"),
      value: ["a"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "QUANTIFIER09",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 3,
      },
      input: Input.Iterable("abc"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "QUANTIFIER10",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 3,
        max: 3,
      },
      input: Input.Iterable("abc"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "QUANTIFIER11",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 3,
        max: 3,
      },
      input: Input.Iterable("ab"),
      kind: MatchKind.Fail,
    }),
  });
  await t.step({
    name: "QUANTIFIER12",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: 3,
        max: 3,
      },
      input: Input.Iterable("abcd"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
      done: false,
    }),
  });
});
