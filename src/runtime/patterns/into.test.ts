import { assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { Input, InputNormalizationMode } from "../../input.ts";
import { getRightmostFailure, MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { MatchErrorCode, Path } from "../../mod.ts";
import { CharacterClass } from "./pattern.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";

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
      input: Input.Iterable([[]]),
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
      input: Input.Iterable([["a"]]),
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
      input: Input.Iterable([["a", "b"]]),
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
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
        },
      },
      input: Input.Iterable([["a", "b"]]),
      value: ["a", "b"],
      kind: MatchKind.Ok,
    }),
  });

  // Into will fail if the inner pattern does not consume the entire stream.
  await t.step({
    name: "INTO04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Into,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.Iterable([["a", "b"]]),
      kind: MatchKind.Fail,
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
      input: Input.Iterable([[["a"]]]),
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
      input: Input.Iterable([["a"], "b"]),
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
      input: Input.Iterable(["abc"]),
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
      input: Input.Iterable([["a", "b", 3]]),
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
          kind: PatternKind.Any,
        },
      },
      input: Input.Iterable([null]),
      kind: MatchKind.Error,
      message: "expected value to be iterable but got type null",
      code: MatchErrorCode.IterableExpected,
      start: Path.From(0),
      end: Path.From(0),
    }),
  });

  await t.step({
    name: "INTO11",
    fn: async () => {
      const pattern = {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Character,
          characterClass: CharacterClass.Letter,
        },
      } as const;
      const scope = Scope.From([[7]], {
        kind: InputNormalizationMode.Iterable,
      });

      const m = await match(pattern, scope);
      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.Type);
      assertEquals(
        m.message,
        "expected value to be a string but got number",
      );
    },
  });

  await t.step({
    name: "INTO12 preserves itemSpans for nested token streams",
    fn: async () => {
      const itemSpans = [
        {
          normalized: { start: 0, end: 1 },
          original: { start: 5, end: 6 },
        },
        {
          normalized: { start: 1, end: 2 },
          original: { start: 6, end: 7 },
        },
      ];
      const scope = Scope.From(
        Input.From([["!"]], {
          kind: InputNormalizationMode.Iterable,
          provenance: { itemSpans },
        }),
      );
      const m = await match(
        {
          kind: PatternKind.Into,
          pattern: { kind: PatternKind.Equal, value: "b" },
        },
        scope,
      );
      assertEquals(m.kind, MatchKind.Fail);
      if (m.kind !== MatchKind.Fail) return;
      const rightmost = getRightmostFailure(m);
      assertEquals(rightmost.originalSpan.start, 5);
      assertEquals(rightmost.normalizedSpan.start, 0);
    },
  });

  await t.step({
    name: "INTO13 maps string items through parent itemSpans",
    fn: async () => {
      const itemSpans = [
        {
          normalized: { start: 0, end: 2 },
          original: { start: 20, end: 22 },
        },
      ];
      const scope = Scope.From(
        Input.From(["ab"], {
          kind: InputNormalizationMode.Iterable,
          provenance: { itemSpans },
        }),
      );
      const m = await match(
        {
          kind: PatternKind.Into,
          pattern: {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: "a" },
              { kind: PatternKind.Equal, value: "c" },
            ],
          },
        },
        scope,
      );
      assertEquals(m.kind, MatchKind.Fail);
      if (m.kind !== MatchKind.Fail) return;
      const rightmost = getRightmostFailure(m);
      assertEquals(rightmost.originalSpan.start, 21);
    },
  });
});
