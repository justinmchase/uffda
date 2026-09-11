import { assert, assertEquals } from "@std/assert";
import { lit } from "../../runtime/patterns/value_source.ts";
import { InputNormalizationMode } from "../../input.ts";
import { match } from "../../runtime/match.ts";
import { Scope } from "../../runtime/scope.ts";
import { MatchKind } from "../../match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";

Deno.test("req:runtime-core-003 - Input item surfaces drive direct, iterable, and keyed traversal semantics", async (t) => {
  await t.step("scalar item is matched directly as one item", async () => {
    const scope = Scope.From("abc");
    const pattern: Pattern = { kind: PatternKind.Equal, value: lit("abc") };
    const m = await match(pattern, scope);

    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(await m.scope.stream.done(), true);
    }
  });

  await t.step(
    "iterable item is traversed by into against nested stream",
    async () => {
      const scope = Scope.From([["a", "b"]], {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Equal, value: lit("a") },
            { kind: PatternKind.Equal, value: lit("b") },
          ],
        },
      };

      const m = await match(pattern, scope);
      assertEquals(m.kind, MatchKind.Ok);
    },
  );

  await t.step("keyed item is traversed by over", async () => {
    const scope = Scope.From([{ x: "a" }], {
      kind: InputNormalizationMode.Iterable,
    });
    const pattern: Pattern = {
      kind: PatternKind.Over,
      keys: {
        x: { kind: PatternKind.Equal, value: lit("a") },
      },
    };

    const m = await match(pattern, scope);
    assertEquals(m.kind, MatchKind.Ok);
  });

  await t.step(
    "single scalar stream does not permit multi-step consumption without nested traversal",
    async () => {
      const scope = Scope.From("abc");
      const pattern: Pattern = {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      };

      const m = await match(pattern, scope);
      assertEquals(m.kind, MatchKind.Fail);
      assert(m.kind !== MatchKind.Ok);
    },
  );
});
