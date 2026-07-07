import { Scope } from "../../runtime/scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";

Deno.test("req:expressions-runtime-004 - String expressions concatenate literal and embedded segments in order", async (t) => {
  await t.step(
    "string expression concatenates literal and embedded expression segments",
    expressionTest({
      scope: Scope.Default().addVariables({
        name: "world",
      }),
      result: "hello world!",
      expression: {
        kind: ExpressionKind.String,
        values: [
          "hello ",
          { kind: ExpressionKind.Reference, name: "name" },
          "!",
        ],
      },
    }),
  );

  await t.step(
    "string expression preserves order across embedded expressions",
    expressionTest({
      result: "a12",
      expression: {
        kind: ExpressionKind.String,
        values: ["a", { kind: ExpressionKind.Value, value: 1 }, {
          kind: ExpressionKind.Value,
          value: 2,
        }],
      },
    }),
  );
});
