import { expressionTest, immediateExpressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { assertEquals } from "@std/assert";
import { originOf, rootOrigin, Wrapped } from "../../wrapped.ts";
import { type MatchOk, ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { Scope } from "../scope.ts";
import { exec } from "../exec.ts";

await Deno.test("runtime/expressions/not", async (t) => {
  await t.step({
    name: "NOT00 - negates a truthy value",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Not,
        expression: { kind: ExpressionKind.Number, value: 1 },
      },
      result: false,
    }),
  });

  await t.step({
    name: "NOT01 - negates an awaitable value",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Not,
        expression: {
          kind: ExpressionKind.Native,
          fn: () => Promise.resolve(false),
        },
      },
      result: true,
    }),
  });

  await t.step({
    name: "NOT_IMMEDIATE - evaluates synchronously over immediate values",
    fn: immediateExpressionTest({
      expression: {
        kind: ExpressionKind.Not,
        expression: { kind: ExpressionKind.Boolean, value: false },
      },
      result: true,
    }),
  });
});

function wrappedMatch(variables: Record<string, unknown> = {}): MatchOk {
  const scope = Scope.Default().addVariables(variables);
  return ok(scope, scope, { kind: PatternKind.Ok }, undefined);
}

Deno.test("runtime/expressions/not observes the raw operand and takes the evaluating match's spans as origin", async () => {
  const m = wrappedMatch({ x: new Wrapped(0, rootOrigin(3)) });
  const r = await exec({
    kind: ExpressionKind.Not,
    expression: { kind: ExpressionKind.Reference, name: "x" },
  }, m);
  assertEquals(r.raw, true);
  assertEquals(r.origin, originOf(m));
});
