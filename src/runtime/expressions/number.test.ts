import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

await Deno.test("runtime/expressions/number", async (t) => {
  await t.step({
    name: "NUMBER00",
    fn: expressionTest({
      match: Match.Default(Scope.Default()),
      result: 7,
      expression: {
        kind: ExpressionKind.Number,
        value: 7,
      },
    }),
  });
});
