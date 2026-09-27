import { assertEquals } from "@std/assert";
import { MatchErrorCode, MatchKind } from "../match.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { Scope } from "./scope.ts";
import { expressionError } from "./expression_error.ts";

Deno.test("runtime/expression_error", async (t) => {
  await t.step(
    "EXPRESSION_ERROR00 - an Error becomes an ExpressionException carrying it",
    () => {
      const err = new Error("boom");
      const m = expressionError(
        Scope.Default(),
        { kind: PatternKind.Any },
        err,
      );
      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.ExpressionException);
      assertEquals(m.message, "expression exception: boom");
    },
  );

  await t.step(
    "EXPRESSION_ERROR01 - a non-Error reason is stringified",
    () => {
      const m = expressionError(Scope.Default(), { kind: PatternKind.Any }, 42);
      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.message, "expression exception: 42");
    },
  );
});
