import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

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
      result: 7,
      expression: {
        kind: ExpressionKind.Value,
        value: 7,
      },
    }),
  });
});
