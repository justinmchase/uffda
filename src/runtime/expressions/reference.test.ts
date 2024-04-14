import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

await Deno.test("runtime/expressions/reference", async (t) => {
  await t.step({
    name: "REFERENCE00",
    fn: expressionTest({
      match: Match.Default(
        Scope.Default().addVariables({
          a: 7,
        }),
      ),
      result: 7,
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
    }),
  });

  await t.step({
    name: "REFERENCE01",
    fn: expressionTest({
      match: Match.Default(
        Scope.Default().addVariables({
          a: 7,
          b: 11,
        }),
      ),
      result: 11,
      expression: {
        kind: ExpressionKind.Reference,
        name: "b",
      },
    }),
  });
});
