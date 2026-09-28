import { immediateExpressionTest } from "../../test.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { assertEquals, assertStrictEquals } from "@std/assert";
import { type MatchOk, ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { Scope } from "../scope.ts";
import { exec } from "../exec.ts";

await Deno.test("runtime/expressions/number", async (t) => {
  await t.step({
    name: "NUMBER00",
    fn: expressionTest({
      result: 7,
      expression: {
        kind: ExpressionKind.Number,
        value: 7,
      },
    }),
  });

  await t.step({
    name: "NUMBER_IMMEDIATE - evaluates synchronously over immediate values",
    fn: immediateExpressionTest({
      expression: { kind: ExpressionKind.Number, value: 1 },
      result: 1,
    }),
  });
});

function wrappedMatch(variables: Record<string, unknown> = {}): MatchOk {
  const scope = Scope.Default().addVariables(variables);
  return ok(scope, scope, { kind: PatternKind.Ok }, undefined);
}

Deno.test("runtime/expressions/number a literal takes the evaluating match as origin", async () => {
  const m = wrappedMatch();
  const r = await exec({ kind: ExpressionKind.Number, value: 7 }, m);
  assertEquals(r.raw, 7);
  assertStrictEquals(r.origin, m);
});
