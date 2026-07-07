import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";

Deno.test("req:expressions-runtime-003 - Literal expressions evaluate to their declared values without consulting runtime scope", async (t) => {
  await t.step(
    "number expression yields its numeric value",
    expressionTest({
      result: 7,
      expression: {
        kind: ExpressionKind.Number,
        value: 7,
      },
    }),
  );

  await t.step(
    "boolean expression yields its boolean value",
    expressionTest({
      result: true,
      expression: {
        kind: ExpressionKind.Boolean,
        value: true,
      },
    }),
  );

  await t.step(
    "value expression yields its serializable value",
    expressionTest({
      result: { x: 7 },
      expression: {
        kind: ExpressionKind.Value,
        value: { x: 7 },
      },
    }),
  );
});
