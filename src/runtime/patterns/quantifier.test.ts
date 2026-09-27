import { awaitableAgreementTest } from "../../test.ts";
import { assert, assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { Input, InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import type { Pattern } from "./pattern.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit, ValueSourceKind } from "./value_source.ts";

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
        min: lit(1),
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
        min: lit(3),
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
        min: lit(1),
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
        min: lit(3),
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
        min: lit(3),
        max: lit(3),
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
        min: lit(3),
        max: lit(3),
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
        min: lit(3),
        max: lit(3),
      },
      input: Input.Iterable("abcd"),
      value: ["a", "b", "c"],
      kind: MatchKind.Ok,
      done: false,
    }),
  });

  await t.step({
    name: "QUANTIFIER_VALUE_SOURCE_BOUNDS",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Type,
          type: Type.String,
        },
        min: { kind: ValueSourceKind.Variable, name: "n" },
        max: { kind: ValueSourceKind.Variable, name: "n" },
      },
      variables: new Map([["n", 2]]),
      input: Input.Iterable("abcd"),
      value: ["a", "b"],
      kind: MatchKind.Ok,
      done: false,
    }),
  });
});

Deno.test("runtime.patterns.quantifier at the end of an open input", async (t) => {
  const pattern: Pattern = {
    kind: PatternKind.Quantifier,
    pattern: { kind: PatternKind.Type, type: Type.String },
  };
  const kinds = async (open: boolean) => {
    const input = Input.From("ab", {
      kind: InputNormalizationMode.Iterable,
      open,
    });
    const m = await match(pattern, Scope.Default().withInput(input));
    assertEquals(m.kind, MatchKind.Ok);
    assert(m.kind === MatchKind.Ok);
    assertEquals(m.value, ["a", "b"]);
    return m.matches.map((child) => child.kind);
  };

  await t.step(
    "attempts its element once more, recording the attempt",
    async () => {
      assertEquals(await kinds(true), [
        MatchKind.Ok,
        MatchKind.Ok,
        MatchKind.Fail,
      ]);
    },
  );

  await t.step(
    "stops without an attempt at the end of a closed input",
    async () => {
      assertEquals(await kinds(false), [MatchKind.Ok, MatchKind.Ok]);
    },
  );

  await t.step({
    name:
      "QUANTIFIER_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: { kind: PatternKind.Any },
      },
      items: ["a", "b", "c"],
    }),
  });
});
