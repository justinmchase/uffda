import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { BinaryOperation } from "./mod.ts";

await Deno.test("runtime/expressions/value", async (t) => {
  await t.step({
    name: "VALUE00",
    fn: expressionTest({
      result: 7,
      expression: {
        kind: ExpressionKind.Value,
        value: 7,
      },
    }),
  });

  await t.step({
    name: "VALUE01",
    fn: expressionTest({
      result: 18,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Add,
        left: {
          kind: ExpressionKind.Value,
          value: 7,
        },
        right: {
          kind: ExpressionKind.Value,
          value: 11,
        },
      },
    }),
  });
});
