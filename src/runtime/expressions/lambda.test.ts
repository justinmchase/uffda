import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { ExpressionKind } from "./expression.kind.ts";

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
