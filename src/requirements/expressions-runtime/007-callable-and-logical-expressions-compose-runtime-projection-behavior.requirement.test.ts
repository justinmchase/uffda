import { Scope } from "../../runtime/scope.ts";
import { expressionTest } from "../../test.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";

Deno.test("req:expressions-runtime-007 - Callable, lambda, native, spread, and unary expressions compose runtime projection behavior", async (t) => {
  await t.step(
    "invocation expression evaluates target and arguments in order",
    expressionTest({
      scope: Scope.Default().withOptions({
        globals: new Map([
          ["fn", (a: number, b: number) => a + b],
        ]),
      }).addVariables({
        a: 7,
        b: 11,
      }),
      result: 18,
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "fn",
        },
        args: [
          { kind: ExpressionKind.Reference, name: "a" },
          { kind: ExpressionKind.Reference, name: "b" },
        ],
      },
    }),
  );

  await t.step(
    "lambda expression binds arguments into the invoked scope",
    expressionTest({
      result: 7,
      expression: {
        kind: ExpressionKind.Invocation,
        args: [{ kind: ExpressionKind.Value, value: 7 }],
        expression: {
          kind: ExpressionKind.Lambda,
          pattern: {
            kind: PatternKind.Then,
            patterns: [{
              kind: PatternKind.Variable,
              name: "a",
              pattern: { kind: PatternKind.Any },
            }],
          },
          expression: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
        },
      },
    }),
  );

  await t.step(
    "native expression returns host callable result directly",
    expressionTest({
      result: 18,
      expression: {
        kind: ExpressionKind.Native,
        fn: () => 7 + 11,
      },
    }),
  );

  await t.step(
    "array and object spread expressions compose evaluated initializers",
    expressionTest({
      result: {
        out: [1, 2, 3],
        merged: { a: 1, b: 2 },
      },
      expression: {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectKey,
            name: "out",
            expression: {
              kind: ExpressionKind.Array,
              expressions: [
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: { kind: ExpressionKind.Value, value: 1 },
                },
                {
                  kind: ExpressionKind.ArraySpread,
                  expression: {
                    kind: ExpressionKind.Array,
                    expressions: [
                      {
                        kind: ExpressionKind.ArrayElement,
                        expression: { kind: ExpressionKind.Value, value: 2 },
                      },
                      {
                        kind: ExpressionKind.ArrayElement,
                        expression: { kind: ExpressionKind.Value, value: 3 },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: ExpressionKind.ObjectKey,
            name: "merged",
            expression: {
              kind: ExpressionKind.Object,
              keys: [
                {
                  kind: ExpressionKind.ObjectSpread,
                  expression: {
                    kind: ExpressionKind.Object,
                    keys: [
                      {
                        kind: ExpressionKind.ObjectKey,
                        name: "a",
                        expression: { kind: ExpressionKind.Value, value: 1 },
                      },
                    ],
                  },
                },
                {
                  kind: ExpressionKind.ObjectSpread,
                  expression: {
                    kind: ExpressionKind.Object,
                    keys: [
                      {
                        kind: ExpressionKind.ObjectKey,
                        name: "b",
                        expression: { kind: ExpressionKind.Value, value: 2 },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  );

  await t.step(
    "not expressions negate their evaluated operand",
    expressionTest({
      result: false,
      expression: {
        kind: ExpressionKind.Not,
        expression: {
          kind: ExpressionKind.Value,
          value: true,
        },
      },
    }),
  );
});
