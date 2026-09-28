import { immediateExpressionTest } from "../../test.ts";
import { Scope } from "../scope.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { expressionTest } from "../../test.ts";
import { assertStrictEquals } from "@std/assert";
import { rootOrigin, Wrapped } from "../../wrapped.ts";
import { type MatchOk, ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { exec } from "../exec.ts";

await Deno.test("runtime/expressions/member", async (t) => {
  await t.step({
    name: "RUNTIME.MEMBER00",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        x: { y: 7 },
      }),
      result: 7,
      expression: {
        kind: ExpressionKind.Member,
        name: "y",
        expression: {
          kind: ExpressionKind.Reference,
          name: "x",
        },
      },
    }),
  });

  await t.step({
    name: "RUNTIME.MEMBER01",
    fn: expressionTest({
      throws: true,
      expression: {
        kind: ExpressionKind.Member,
        name: "x",
        expression: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
      },
    }),
  });

  await t.step({
    name: "RUNTIME.MEMBER02",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: {},
      }),
      expression: {
        kind: ExpressionKind.Member,
        name: "x",
        expression: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
      },
    }),
  });

  await t.step({
    name: "MEMBER_IMMEDIATE - evaluates synchronously over immediate values",
    fn: immediateExpressionTest({
      expression: {
        kind: ExpressionKind.Member,
        name: "x",
        expression: { kind: ExpressionKind.Value, value: { x: 1 } },
      },
      result: 1,
    }),
  });
});

function wrappedMatch(variables: Record<string, unknown> = {}): MatchOk {
  const scope = Scope.Default().addVariables(variables);
  return ok(scope, scope, { kind: PatternKind.Ok }, undefined);
}

Deno.test("runtime/expressions/member carries the property's own wrapper", async () => {
  const name = new Wrapped("a", rootOrigin(5));
  const m = wrappedMatch({ x: new Wrapped({ name }, rootOrigin(4, 7)) });
  const r = await exec({
    kind: ExpressionKind.Member,
    name: "name",
    expression: { kind: ExpressionKind.Reference, name: "x" },
  }, m);
  assertStrictEquals(r, name);
});
