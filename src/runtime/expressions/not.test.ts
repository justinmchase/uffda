import { expressionTest, immediateExpressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

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
