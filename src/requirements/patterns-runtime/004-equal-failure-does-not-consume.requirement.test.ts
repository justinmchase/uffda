import { assertEquals } from "@std/assert";
import { InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { match } from "../../runtime/match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Scope } from "../../runtime/scope.ts";

Deno.test("req:equal-004 - Equal failure does not consume input and reports failure output", async (t) => {
  await t.step("mismatch fails without consuming input", async () => {
    const scope = Scope.From(["a", "b"], {
      kind: InputNormalizationMode.Iterable,
    });
    const pattern: Pattern = { kind: PatternKind.Equal, value: "x" };

    const m = await match(pattern, scope);
    assertEquals(m.kind, MatchKind.Fail);
    assertEquals(m.scope.stream.path, Path.From(0));
    assertEquals(m.scope.stream.done, false);
  });

  await t.step("end-of-input failure also preserves position", async () => {
    const root = Scope.From(["a"], { kind: InputNormalizationMode.Iterable });
    const end = root.withInput(root.stream.next());
    const pattern: Pattern = { kind: PatternKind.Equal, value: "x" };

    const m = await match(pattern, end);
    assertEquals(m.kind, MatchKind.Fail);
    assertEquals(m.scope.stream.path, Path.From(1));
    assertEquals(m.scope.stream.done, true);
  });
});
