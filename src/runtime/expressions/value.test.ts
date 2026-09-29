import { immediateExpressionTest } from "../../test.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { assertEquals } from "@std/assert";
import { type MatchOk, ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { Scope } from "../scope.ts";
import { exec } from "../exec.ts";
import { originOf } from "../../wrapped.ts";

await Deno.test("runtime/expressions/value", async (t) => {
  await t.step({
    name: "VALUE00",
    fn: expressionTest({
      result: 7,
      expression: {
        kind: ExpressionKind.Value,
        value: 7,
      },
    }),
  });

  await t.step({
    name: "VALUE01",
    fn: expressionTest({
      result: 7,
      expression: {
        kind: ExpressionKind.Value,
        value: 7,
      },
    }),
  });

  await t.step({
    name: "VALUE_IMMEDIATE - evaluates synchronously over immediate values",
    fn: immediateExpressionTest({
      expression: { kind: ExpressionKind.Value, value: "v" },
      result: "v",
    }),
  });
});

function wrappedMatch(variables: Record<string, unknown> = {}): MatchOk {
  const scope = Scope.Default().addVariables(variables);
  return ok(scope, scope, { kind: PatternKind.Ok }, undefined);
}

Deno.test("runtime/expressions/value a literal takes the evaluating match's spans as origin", async () => {
  const m = wrappedMatch();
  const r = await exec({ kind: ExpressionKind.Value, value: null }, m);
  assertEquals(r.raw, null);
  assertEquals(r.origin, originOf(m));
});
