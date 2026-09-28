import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { ok } from "../../match.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { exec } from "../../runtime/exec.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { Scope } from "../../runtime/scope.ts";
import { unwrap } from "../../wrapped.ts";

Deno.test("req:expressions-runtime-010 - `this` resolves to the current MatchOk", async () => {
  const scope = Scope.Default().withInput(Input.From("hi"));
  const match = ok(scope, scope, { kind: PatternKind.Any }, "v");

  const value = await exec(
    {
      kind: ExpressionKind.Member,
      expression: {
        kind: ExpressionKind.Member,
        expression: { kind: ExpressionKind.Reference, name: "this" },
        name: "pattern",
      },
      name: "kind",
    },
    match,
  );
  assertEquals(unwrap(value), PatternKind.Any);
});
