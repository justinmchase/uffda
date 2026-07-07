import { assertEquals } from "@std/assert";
import { Input, InputNormalizationMode } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";
import { match } from "../../runtime/match.ts";
import { Scope } from "../../runtime/scope.ts";

Deno.test("req:except-001 - Except is a zero-width negative assertion followed by one-item consumption", async (t) => {
  await t.step(
    "except succeeds and consumes one item when child fails",
    patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: "x" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "except fails without consumption when child succeeds",
    patternTest({
      pattern: {
        kind: PatternKind.Except,
        pattern: { kind: PatternKind.Equal, value: "a" },
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );

  await t.step(
    "except returns failure with attached child error when child evaluation errors",
    async () => {
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
  );
});
