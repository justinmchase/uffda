import { Scope } from "../../runtime/scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";

Deno.test("req:expressions-runtime-005 - Reference and member expressions resolve scope values and project object properties", async (t) => {
  await t.step(
    "reference expression resolves local match variable before globals",
    expressionTest({
      scope: Scope.Default().withOptions({
        globals: new Map([["a", 11]]),
      }).addVariables({
        a: 7,
      }),
      result: 7,
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
    }),
  );

  await t.step(
    "member expression projects an object property from an evaluated base expression",
    expressionTest({
      scope: Scope.Default().addVariables({
        x: { y: 7 },
      }),
      result: 7,
      expression: {
        kind: ExpressionKind.Member,
        name: "y",
        expression: {
          kind: ExpressionKind.Reference,
          name: "x",
        },
      },
    }),
  );
});
