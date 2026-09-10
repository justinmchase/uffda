import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind, ok } from "../../match.ts";
import { Path } from "../../path.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { exec } from "../../runtime/exec.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { Scope } from "../../runtime/scope.ts";
import { match_leaf_offset } from "../../runtime/std/match_leaf_offset.ts";

Deno.test("req:expressions-runtime-010 - match-aware invocation injects MatchOk", async () => {
  const scope = new Scope(
    undefined,
    undefined,
    new Map(),
    new Map(),
    Input.From("hi"),
    undefined,
    undefined,
    {
      globals: new Map([["match_leaf_offset", match_leaf_offset]]),
    },
  );
  const base = ok(scope, scope, { kind: PatternKind.Any }, undefined);
  const match = {
    ...base,
    span: { start: Path.From(4), end: Path.From(6) },
    kind: MatchKind.Ok as const,
  };
  const value = await exec(
    {
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "match_leaf_offset",
      },
      args: [{ kind: ExpressionKind.Value, value: "end" }],
    },
    match,
  );
  assertEquals(value, 6);
});
