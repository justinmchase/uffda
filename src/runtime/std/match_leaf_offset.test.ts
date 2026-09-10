import { assertEquals, assertThrows } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind, ok } from "../../match.ts";
import { Path } from "../../path.ts";
import { ExpressionKind } from "../expressions/expression.kind.ts";
import { exec } from "../exec.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { Scope } from "../scope.ts";
import { match_leaf_offset } from "./match_leaf_offset.ts";
import { isMatchAware } from "./match_aware.ts";

Deno.test("std.match_leaf_offset is match-aware", () => {
  assertEquals(isMatchAware(match_leaf_offset), true);
});

Deno.test("std.match_leaf_offset reads span leaf numbers", () => {
  const start = Path.From(3);
  const end = Path.From(5);
  const scope = Scope.From(Input.From("ab"));
  const match = ok(
    scope,
    scope,
    { kind: PatternKind.Any },
    "x",
    [],
  );
  // ok() uses scope spans; build a match-like object via Object.assign
  const withSpan = {
    ...match,
    span: { start, end },
  };
  assertEquals(match_leaf_offset(withSpan as typeof match, "start"), 3);
  assertEquals(match_leaf_offset(withSpan as typeof match, "end"), 5);
  assertThrows(
    () => match_leaf_offset(withSpan as typeof match, "mid" as "start"),
    TypeError,
  );
});

Deno.test("invocation injects MatchOk for match_leaf_offset", async () => {
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
  const start = Path.From(7);
  const end = Path.From(9);
  const base = ok(scope, scope, { kind: PatternKind.Any }, undefined);
  const match = {
    ...base,
    span: { start, end },
    kind: MatchKind.Ok as const,
  };
  const value = await exec(
    {
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "match_leaf_offset",
      },
      args: [{ kind: ExpressionKind.Value, value: "start" }],
    },
    match,
  );
  assertEquals(value, 7);
});
