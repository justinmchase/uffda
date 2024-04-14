import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { BinaryOperation } from "./mod.ts";
import { expressionTest } from "../../test.ts";

await Deno.test("runtime/expressions/member", async (t) => {
  await t.step({
    name: "RUNTIME.MEMBER00",
    fn: expressionTest({
      match: Match.Default(
        Scope.Default().addVariables({
          a: { x: 7, y: 11 },
        }),
      ),
      result: 18,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Add,
        left: {
          kind: ExpressionKind.Member,
          name: "x",
          expression: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
        },
        right: {
          kind: ExpressionKind.Member,
          name: "y",
          expression: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
        },
      },
    }),
  });

  await t.step({
    name: "RUNTIME.MEMBER01",
    fn: expressionTest({
      match: Match.Default(Scope.Default()),
      throws: true,
      expression: {
        kind: ExpressionKind.Member,
        name: "x",
        expression: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
      },
    }),
  });

  await t.step({
    name: "RUNTIME.MEMBER02",
    fn: expressionTest({
      match: Match.Default(
        Scope.Default().addVariables({
          a: {},
        }),
      ),
      expression: {
        kind: ExpressionKind.Member,
        name: "x",
        expression: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
      },
    }),
  });
});
