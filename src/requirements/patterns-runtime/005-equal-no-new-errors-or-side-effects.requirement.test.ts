import { assertEquals, assertStrictEquals } from "@std/assert";
import { InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { match } from "../../runtime/match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Scope } from "../../runtime/scope.ts";

Deno.test("req:equal-005 - Equal introduces no new error states and no external side effects", async (t) => {
  await t.step(
    "equal outcomes are limited to ok/fail for valid scope inputs",
    () => {
      const successScope = Scope.From(["a"], {
        kind: InputNormalizationMode.Iterable,
      });
      const failureScope = Scope.From(["b"], {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = { kind: PatternKind.Equal, value: "a" };

      const okMatch = match(pattern, successScope);
      const failMatch = match(pattern, failureScope);

      assertEquals(okMatch.kind, MatchKind.Ok);
      assertEquals(failMatch.kind, MatchKind.Fail);
    },
  );

  await t.step("equal does not mutate caller-visible variable bindings", () => {
    const scope = Scope.From(["a"], { kind: InputNormalizationMode.Iterable });
    const pattern: Pattern = { kind: PatternKind.Equal, value: "a" };

    const beforeSize = scope.variables.size;
    const m = match(pattern, scope);

    assertEquals(scope.variables.size, beforeSize);
    if (m.kind === MatchKind.Ok) {
      assertStrictEquals(m.scope.variables, scope.variables);
    }
  });
});
