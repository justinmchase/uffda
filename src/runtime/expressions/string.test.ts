import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

await Deno.test("runtime/expressions/string", async (t) => {
  await t.step({
    name: "STRING00",
    fn: expressionTest({
      result: "abc",
      expression: {
        kind: ExpressionKind.String,
        values: ["abc"],
      },
    }),
  });

  await t.step({
    name: "STRING01",
    fn: expressionTest({
      result: "abc123xyz",
      expression: {
        kind: ExpressionKind.String,
        values: [
          "abc",
          { kind: ExpressionKind.Number, value: 123 },
          {
            kind: ExpressionKind.String,
            values: ["xyz"],
          },
        ],
      },
    }),
  });
});
