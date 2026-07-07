import { assertEquals } from "@std/assert";
import { match } from "../../runtime/match.ts";
import { Scope } from "../../runtime/scope.ts";
import { InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Path } from "../../path.ts";

Deno.test("req:runtime-core-005 - Failed and zero-width outcomes preserve caller-visible input position", async (t) => {
  await t.step("failed match preserves caller-visible position", async () => {
    const scope = Scope.From("a", { kind: InputNormalizationMode.Iterable });
    const pattern: Pattern = { kind: PatternKind.Equal, value: "x" };

    const m = await match(pattern, scope);
    assertEquals(m.kind, MatchKind.Fail);
    assertEquals(m.scope.stream.path, Path.From(0));
  });

  await t.step("zero-width not preserves caller-visible position", async () => {
    const scope = Scope.From("a", { kind: InputNormalizationMode.Iterable });
    const pattern: Pattern = {
      kind: PatternKind.Not,
      pattern: { kind: PatternKind.Equal, value: "x" },
    };

    const m = await match(pattern, scope);
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(m.scope.stream.path, Path.From(0));
  });

  await t.step("input-consuming success reports updated position", async () => {
    const scope = Scope.From("a", { kind: InputNormalizationMode.Iterable });
    const pattern: Pattern = { kind: PatternKind.Any };

    const m = await match(pattern, scope);
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(m.scope.stream.path, Path.From(1));
  });
});
