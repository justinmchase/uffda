import { assertEquals } from "@std/assert";
import { lit } from "../../runtime/patterns/value_source.ts";
import { InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { match } from "../../runtime/match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Scope } from "../../runtime/scope.ts";

Deno.test("req:equal-001 - Equal inspects the current input position and fails at end-of-input", async (t) => {
  await t.step(
    "equal inspects and matches at the current position",
    async () => {
      const root = Scope.From("ab", { kind: InputNormalizationMode.Iterable });
      const atB = root.withInput(await root.stream.next());
      const pattern: Pattern = { kind: PatternKind.Equal, value: lit("b") };

      const m = await match(pattern, atB);
      assertEquals(m.kind, MatchKind.Ok);
    },
  );

  await t.step(
    "equal fails at end-of-input without changing position",
    async () => {
      const root = Scope.From("a", { kind: InputNormalizationMode.Iterable });
      const end = root.withInput(await root.stream.next());
      const pattern: Pattern = { kind: PatternKind.Equal, value: lit("x") };

      const m = await match(pattern, end);
      assertEquals(m.kind, MatchKind.Fail);
      assertEquals(m.scope.stream.path, Path.From(1));
    },
  );
});
