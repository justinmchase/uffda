import { assertStrictEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { Input } from "../input.ts";
import { MatchErrorCode, MatchKind } from "../match.ts";
import { patternTest } from "../test.ts";
import { Scope } from "./scope.ts";
import { compile, match } from "./match.ts";
import { type CharacterClass, PatternKind } from "./patterns/mod.ts";
import type { Pattern } from "./patterns/pattern.ts";

await Deno.test("runtime.match", async (t) => {
  await t.step({
    name:
      "MATCH00 - compiling the same node object twice returns the same closure",
    fn: () => {
      const pattern: Pattern = { kind: PatternKind.Any };
      const a = compile(pattern);
      const b = compile(pattern);
      assertStrictEquals(a, b);
    },
  });

  await t.step({
    name: "MATCH01 - two structurally identical nodes compile independently",
    fn: () => {
      const a: Pattern = { kind: PatternKind.Any };
      const b: Pattern = { kind: PatternKind.Any };
      const ca = compile(a);
      const cb = compile(b);
      assertStrictEquals(ca === cb, false);
    },
  });

  // Then/And/Or/Character/Variable/Type each have a compiled implementation;
  // these cases exercise their Ok/Fail/Error outcomes through `match()`
  // (which now routes through `compile`) to prove parity with the
  // pre-compilation interpreter behavior for every match kind.
  await t.step({
    name: "MATCH02 - compiled Then still fails and reports the failing child",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "MATCH03 - compiled And merges variables across steps",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "a",
            pattern: { kind: PatternKind.Any },
          },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });

  await t.step({
    name: "MATCH04 - compiled Or falls through to a later alternative",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.End },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });

  await t.step({
    name: "MATCH05 - compiled Character reports an error for an unknown class",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: "not-a-class" as CharacterClass,
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.InvalidArgument,
      message: "unknown character class not-a-class",
      start: Input.Iterable("a").path,
      end: Input.Iterable("a").path,
    }),
  });

  await t.step({
    name: "MATCH06 - compiled Variable rejects a name already bound in scope",
    fn: async () => {
      const pattern: Pattern = {
        kind: PatternKind.Variable,
        name: "a",
        pattern: { kind: PatternKind.Any },
      };
      const scope = new Scope(
        undefined,
        undefined,
        new Map([["a", 1]]),
        new Map(),
        Input.Iterable("x"),
      );
      const m = await match(pattern, scope);
      if (m.kind !== MatchKind.Error) {
        throw new Error(`expected an error match but got ${m.kind}`);
      }
      if (m.code !== MatchErrorCode.DuplicateVariable) {
        throw new Error(`expected ${MatchErrorCode.DuplicateVariable}`);
      }
    },
  });

  await t.step({
    name: "MATCH07 - compiled Type fails on end of input",
    fn: patternTest({
      pattern: { kind: PatternKind.Type, type: Type.String },
      input: Input.Iterable([]),
      kind: MatchKind.Fail,
      done: true,
    }),
  });

  await t.step({
    name: "MATCH08 - a compiled composite may contain interpreted children",
    fn: patternTest({
      // `Then` is compiled; `Lookahead` currently has no compiled
      // implementation and falls back to the generic interpreter — this
      // proves the two dispatch paths compose correctly within one rule.
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Lookahead,
            pattern: { kind: PatternKind.Any },
          },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: ["a", "a"],
    }),
  });
});
