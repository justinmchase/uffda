import { assertEquals } from "@std/assert";
import { Input, InputNormalizationMode } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";

Deno.test("runtime.patterns.except", async (t) => {
  await t.step({
    name: "EXCEPT00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "EXCEPT01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("b"),
      kind: MatchKind.Ok,
      value: "b",
    }),
  });

  await t.step({
    name: "EXCEPT02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Any },
      },
      input: Input.Iterable(""),
      kind: MatchKind.Fail,
      done: true,
    }),
  });

  await t.step({
    name: "EXCEPT03",
    fn: async () => {
      const pattern = {
        kind: PatternKind.Except,
        pattern: {
          kind: PatternKind.Into,
          pattern: { kind: PatternKind.Any },
        },
      } as const;
      const scope = Scope.From([7], {
        kind: InputNormalizationMode.Iterable,
      });

      const m = await match(pattern, scope);

      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.IterableExpected);
      assertEquals(m.scope.stream.path, scope.stream.path);
    },
  });
});
