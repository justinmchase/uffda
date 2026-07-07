import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";

Deno.test("req:expressions-runtime-006 - Array and object expressions compose child values in declaration order", async (t) => {
  await t.step(
    "array expression appends element and spread initializers in declaration order",
    expressionTest({
      result: [7, 11, 13],
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArrayElement,
            expression: {
              kind: ExpressionKind.Value,
              value: 7,
            },
          },
          {
            kind: ExpressionKind.ArraySpread,
            expression: {
              kind: ExpressionKind.Value,
              value: [11, 13],
            },
          },
        ],
      },
    }),
  );

  await t.step(
    "object expression applies key and spread initializers in declaration order",
    expressionTest({
      result: { x: 13, y: 11, z: 19 },
      expression: {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectSpread,
            expression: {
              kind: ExpressionKind.Value,
              value: { x: 7, y: 11 },
            },
          },
          {
            kind: ExpressionKind.ObjectKey,
            name: "x",
            expression: {
              kind: ExpressionKind.Value,
              value: 13,
            },
          },
          {
            kind: ExpressionKind.ObjectSpread,
            expression: {
              kind: ExpressionKind.Value,
              value: { z: 19 },
            },
          },
        ],
      },
    }),
  );
});
