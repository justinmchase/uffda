import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { assertEquals, assertStrictEquals } from "@std/assert";
import { originOf, rootOrigin, Wrapped } from "../../wrapped.ts";
import { type MatchOk, ok } from "../../match.ts";
import { exec } from "../exec.ts";

await Deno.test("runtime/expressions/lambda", async (t) => {
  await t.step({
    name: "RUNTIME.LAMBDA00",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: 11,
      }),
      result: 11,
      expression: {
        // (!any -> a + b)
        kind: ExpressionKind.Invocation,
        args: [],
        expression: {
          kind: ExpressionKind.Lambda,
          pattern: {
            kind: PatternKind.Not,
            pattern: {
              kind: PatternKind.Any,
            },
          },
          expression: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
        },
      },
    }),
  });

  await t.step({
    name: "RUNTIME.LAMBDA01",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: 7,
        b: 11,
      }),
      result: 18,
      expression: {
        // (!any -> [native])
        kind: ExpressionKind.Invocation,
        args: [],
        expression: {
          kind: ExpressionKind.Lambda,
          pattern: {
            kind: PatternKind.Not,
            pattern: {
              kind: PatternKind.Any,
            },
          },
          expression: {
            kind: ExpressionKind.Native,
            fn: () => 7 + 11,
          },
        },
      },
    }),
  });

  await t.step({
    name: "RUNTIME.LAMBDA02",
    fn: expressionTest({
      result: 7,
      expression: {
        // (a:any -> a)
        kind: ExpressionKind.Invocation,
        args: [
          {
            kind: ExpressionKind.Value,
            value: 7,
          },
        ],
        expression: {
          kind: ExpressionKind.Lambda,
          pattern: {
            kind: PatternKind.Then,
            patterns: [
              {
                kind: PatternKind.Variable,
                name: "a",
                pattern: { kind: PatternKind.Any },
              },
            ],
          },
          expression: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
        },
      },
    }),
  });
});

function wrappedMatch(variables: Record<string, unknown> = {}): MatchOk {
  const scope = Scope.Default().addVariables(variables);
  return ok(scope, scope, { kind: PatternKind.Ok }, undefined);
}

Deno.test("runtime/expressions/lambda the callable takes the match's spans as origin and returns wrapped results", async () => {
  const m = wrappedMatch();
  const r = await exec({
    kind: ExpressionKind.Lambda,
    pattern: { kind: PatternKind.Any },
    expression: { kind: ExpressionKind.Reference, name: "_" },
  }, m);
  assertEquals(r.origin, originOf(m));
  const item = new Wrapped(1, rootOrigin(3));
  const result = await (r.raw as (...args: unknown[]) => unknown)(item);
  assertStrictEquals(result, item);
});
