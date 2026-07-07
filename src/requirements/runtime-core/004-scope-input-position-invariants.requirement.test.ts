import { assertEquals } from "@std/assert";
import { match } from "../../runtime/match.ts";
import { Scope } from "../../runtime/scope.ts";
import { InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Path } from "../../path.ts";

Deno.test("req:runtime-core-004 - Runtime scope carries active input position and transitions immutably", async () => {
  const start = Scope.From("ab", { kind: InputNormalizationMode.Iterable });
  const pattern: Pattern = { kind: PatternKind.Equal, value: "a" };

  const m = await match(pattern, start);
  assertEquals(m.kind, MatchKind.Ok);

  if (m.kind !== MatchKind.Ok) return;

  // Incoming scope is unchanged.
  assertEquals(start.stream.path, Path.From(0));
  assertEquals(start.stream.done, false);

  // Resulting scope reflects consumed input.
  assertEquals(m.scope.stream.path, Path.From(1));
  assertEquals(m.scope.stream.done, false);
});
