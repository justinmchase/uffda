import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../mod.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit, ValueSourceKind } from "./value_source.ts";

await Deno.test("runtime/patterns/equal", async (t) => {
  await t.step({
    name: "EQUAL00",
    fn: patternTest({
      pattern: { kind: PatternKind.Equal, value: lit("a") },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "EQUAL00",
    fn: patternTest({
      pattern: { kind: PatternKind.Equal, value: lit(7) },
      input: Input.Iterable([7]),
      value: 7,
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "EQUAL00",
    fn: patternTest({
      pattern: { kind: PatternKind.Equal, value: lit(7) },
      input: Input.Iterable([11]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "EQUAL_VALUE_SOURCE_LITERAL",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Equal,
        value: lit("a"),
      },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "EQUAL_VALUE_SOURCE_VARIABLE",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Equal,
        value: { kind: ValueSourceKind.Variable, name: "x" },
      },
      variables: new Map([["x", "a"]]),
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "EQUAL_VALUE_SOURCE_UNBOUND",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Equal,
        value: { kind: ValueSourceKind.Variable, name: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Error,
      code: MatchErrorCode.UnknownReference,
      message: "Unknown value reference $x",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
});
