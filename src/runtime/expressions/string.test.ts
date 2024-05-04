import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

await Deno.test("runtime/expressions/string", async (t) => {
  await t.step({
    name: "STRING00",
    fn: expressionTest({
      result: "abc",
      expression: {
        kind: ExpressionKind.String,
        value: "abc",
      },
    }),
  });
});
