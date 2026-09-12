import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind, ok } from "../../match.ts";
import { Path } from "../../path.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { exec } from "../../runtime/exec.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { Scope } from "../../runtime/scope.ts";

Deno.test("req:expressions-runtime-010 - `this` resolves to the current MatchOk", async () => {
  const scope = Scope.Default().withInput(Input.From("hi"));
  const base = ok(scope, scope, { kind: PatternKind.Any }, undefined);
  const match = {
    ...base,
    span: { start: Path.From(4), end: Path.From(6) },
    normalizedSpan: { start: 4, end: 6 },
    kind: MatchKind.Ok as const,
  };

  const value = await exec(
    {
      kind: ExpressionKind.Member,
      expression: {
        kind: ExpressionKind.Member,
        expression: { kind: ExpressionKind.Reference, name: "this" },
        name: "normalizedSpan",
      },
      name: "end",
    },
    match,
  );
  assertEquals(value, 6);
});
