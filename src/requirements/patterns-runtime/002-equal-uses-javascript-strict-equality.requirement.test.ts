import { assertEquals } from "@std/assert";
import { InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { match } from "../../runtime/match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Scope } from "../../runtime/scope.ts";

Deno.test("req:equal-002 - Equal compares the current item using JavaScript strict equality", async (t) => {
  await t.step(
    "strict equality matches identical primitive value",
    async () => {
      const scope = Scope.From([7], { kind: InputNormalizationMode.Iterable });
      const pattern: Pattern = { kind: PatternKind.Equal, value: 7 };

      const m = await match(pattern, scope);
      assertEquals(m.kind, MatchKind.Ok);
    },
  );

  await t.step("strict equality rejects type-coercive near match", async () => {
    const scope = Scope.From(["7"], { kind: InputNormalizationMode.Iterable });
    const pattern: Pattern = { kind: PatternKind.Equal, value: 7 };

    const m = await match(pattern, scope);
    assertEquals(m.kind, MatchKind.Fail);
  });

  await t.step(
    "strict equality on objects requires same reference",
    async () => {
      const shared = { x: 1 };
      const scopeOk = Scope.From([shared], {
        kind: InputNormalizationMode.Iterable,
      });
      const scopeFail = Scope.From([{ x: 1 }], {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = { kind: PatternKind.Equal, value: shared };

      const okMatch = await match(pattern, scopeOk);
      const failMatch = await match(pattern, scopeFail);

      assertEquals(okMatch.kind, MatchKind.Ok);
      assertEquals(failMatch.kind, MatchKind.Fail);
    },
  );
});
