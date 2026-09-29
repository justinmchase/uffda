import { immediateExpressionTest } from "../../test.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { assertEquals } from "@std/assert";
import { type MatchOk, ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { Scope } from "../scope.ts";
import { exec } from "../exec.ts";
import { originOf } from "../../wrapped.ts";

await Deno.test("runtime/expressions/boolean", async (t) => {
  await t.step({
    name: "BOOLEAN00",
    fn: expressionTest({
      result: true,
      expression: {
        kind: ExpressionKind.Boolean,
        value: true,
      },
    }),
  });

  await t.step({
    name: "BOOLEAN00",
    fn: expressionTest({
      result: false,
      expression: {
        kind: ExpressionKind.Boolean,
        value: false,
      },
    }),
  });

  await t.step({
    name: "BOOLEAN_IMMEDIATE - evaluates synchronously over immediate values",
    fn: immediateExpressionTest({
      expression: { kind: ExpressionKind.Boolean, value: true },
      result: true,
    }),
  });
});

function wrappedMatch(variables: Record<string, unknown> = {}): MatchOk {
  const scope = Scope.Default().addVariables(variables);
  return ok(scope, scope, { kind: PatternKind.Ok }, undefined);
}

Deno.test("runtime/expressions/boolean a literal takes the evaluating match's spans as origin", async () => {
  const m = wrappedMatch();
  const r = await exec({ kind: ExpressionKind.Boolean, value: true }, m);
  assertEquals(r.raw, true);
  assertEquals(r.origin, originOf(m));
});
