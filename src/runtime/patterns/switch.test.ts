import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { CharacterClass } from "./pattern.ts";
import type { SwitchPattern } from "./pattern.ts";
import { lit, ValueSourceKind } from "./value_source.ts";
import { switchPattern } from "./switch.ts";
import { Scope } from "../scope.ts";

await Deno.test("runtime/patterns/switch", async (t) => {
  await t.step({
    name: "SWITCH00 dispatches on a literal value key",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Switch,
        cases: [
          {
            key: { kind: "values", values: [lit("#")] },
            pattern: { kind: PatternKind.Equal, value: lit("#") },
          },
        ],
      },
      input: Input.Iterable("#"),
      value: "#",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "SWITCH01 dispatches on a character-class key",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Switch,
        cases: [
          {
            key: {
              kind: "characterClass",
              characterClass: CharacterClass.Letter,
            },
            pattern: { kind: PatternKind.Any },
          },
        ],
      },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "SWITCH02 fails with no matching case and no default",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Switch,
        cases: [
          {
            key: { kind: "values", values: [lit("#")] },
            pattern: { kind: PatternKind.Equal, value: lit("#") },
          },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
    }),
  });

  await t.step({
    name: "SWITCH03 falls back to default when no case key matches",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Switch,
        cases: [
          {
            key: { kind: "values", values: [lit("#")] },
            pattern: { kind: PatternKind.Equal, value: lit("#") },
          },
        ],
        default: { kind: PatternKind.Any },
      },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "SWITCH04 fails at eof with no matching case, even with a default",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Switch,
        cases: [],
        default: { kind: PatternKind.Any },
      },
      input: Input.Iterable([]),
      kind: MatchKind.Fail,
      done: true,
    }),
  });

  await t.step({
    name: "SWITCH_VALUE_SOURCE_VARIABLE resolves a variable-sourced key",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Switch,
        cases: [
          {
            key: {
              kind: "values",
              values: [{ kind: ValueSourceKind.Variable, name: "a" }],
            },
            pattern: { kind: PatternKind.Any },
          },
        ],
      },
      variables: new Map([["a", "x"]]),
      input: Input.Iterable("x"),
      value: "x",
      kind: MatchKind.Ok,
    }),
  });

  await t.step(
    "committed choice: a chosen case that fails does not fall through to a later case whose key would also match",
    async () => {
      const pattern: SwitchPattern = {
        kind: PatternKind.Switch,
        cases: [
          {
            key: { kind: "values", values: [lit("a")] },
            pattern: { kind: PatternKind.Equal, value: lit("z") },
          },
          {
            key: { kind: "values", values: [lit("a")] },
            pattern: { kind: PatternKind.Equal, value: lit("a") },
          },
        ],
      };
      const scope = new Scope(
        undefined,
        undefined,
        new Map(),
        new Map(),
        Input.Iterable(["a"]),
      );
      const m = await switchPattern(pattern, scope)(scope);
      // The first case's key ("a") matches, so only its body (Equal("z"))
      // is ever attempted; it fails against the actual value "a", and the
      // Switch fails outright rather than trying the second case, even
      // though the second case's own body would have matched.
      assertEquals(m.kind, MatchKind.Fail);
    },
  );

  await t.step(
    "an unknown character class reports an error rather than silently failing to match",
    async () => {
      const pattern: SwitchPattern = {
        kind: PatternKind.Switch,
        cases: [
          {
            key: {
              kind: "characterClass",
              characterClass: "?" as CharacterClass,
            },
            pattern: { kind: PatternKind.Any },
          },
        ],
      };
      const scope = new Scope(
        undefined,
        undefined,
        new Map(),
        new Map(),
        Input.Iterable(["a"]),
      );
      const m = await switchPattern(pattern, scope)(scope);
      assertEquals(m.kind, MatchKind.Error);
      if (m.kind === MatchKind.Error) {
        assertEquals(m.code, MatchErrorCode.InvalidArgument);
      }
    },
  );

  await t.step(
    "a non-string current item against a characterClass key reports a type error rather than silently falling through",
    async () => {
      const pattern: SwitchPattern = {
        kind: PatternKind.Switch,
        cases: [
          {
            key: {
              kind: "characterClass",
              characterClass: CharacterClass.Letter,
            },
            pattern: { kind: PatternKind.Any },
          },
        ],
        default: { kind: PatternKind.Fail },
      };
      const scope = new Scope(
        undefined,
        undefined,
        new Map(),
        new Map(),
        Input.Iterable([1]),
      );
      const m = await switchPattern(pattern, scope)(scope);
      assertEquals(m.kind, MatchKind.Error);
      if (m.kind === MatchKind.Error) {
        assertEquals(m.code, MatchErrorCode.Type);
        assertEquals(m.message, "expected value to be a string but got number");
      }
    },
  );

  await t.step(
    "a resolution error on a variable-sourced key is surfaced as an Error",
    async () => {
      const pattern: SwitchPattern = {
        kind: PatternKind.Switch,
        cases: [
          {
            key: {
              kind: "values",
              values: [{ kind: ValueSourceKind.Variable, name: "unbound" }],
            },
            pattern: { kind: PatternKind.Any },
          },
        ],
      };
      const scope = new Scope(
        undefined,
        undefined,
        new Map(),
        new Map(),
        Input.Iterable(["a"]),
      );
      const m = await switchPattern(pattern, scope)(scope);
      assertEquals(m.kind, MatchKind.Error);
      if (m.kind === MatchKind.Error) {
        assertEquals(m.code, MatchErrorCode.UnknownReference);
      }
    },
  );
});
