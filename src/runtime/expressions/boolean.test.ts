import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

await Deno.test("runtime/expressions/boolean", async (t) => {
  await t.step({
    name: "BOOLEAN00",
    fn: expressionTest({
      result: true,
      expression: {
        kind: ExpressionKind.Boolean,
        value: true,
      },
    }),
  });

  await t.step({
    name: "BOOLEAN00",
    fn: expressionTest({
      result: false,
      expression: {
        kind: ExpressionKind.Boolean,
        value: false,
      },
    }),
  });
});
