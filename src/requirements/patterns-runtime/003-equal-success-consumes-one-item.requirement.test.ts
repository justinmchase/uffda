import { assertEquals } from "@std/assert";
import { InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { match } from "../../runtime/match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Scope } from "../../runtime/scope.ts";

Deno.test("req:equal-003 - Equal success consumes exactly one item and reports the consumed value", () => {
  const scope = Scope.From(["a", "b"], {
    kind: InputNormalizationMode.Iterable,
  });
  const pattern: Pattern = { kind: PatternKind.Equal, value: "a" };

  const m = match(pattern, scope);
  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind !== MatchKind.Ok) return;

  assertEquals(m.value, "a");
  assertEquals(m.scope.stream.path, Path.From(1));
  assertEquals(m.scope.stream.done, false);
});
