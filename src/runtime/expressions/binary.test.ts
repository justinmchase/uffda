import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { BinaryOperation } from "./expression.ts";
import { ExpressionKind } from "./expression.kind.ts";

await Deno.test("runtime/patterns/binary", async (t) => {
  await t.step({
    name: "ADD00",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: 7,
        b: 11,
      }),
      result: 18,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Add,
        left: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
        right: {
          kind: ExpressionKind.Reference,
          name: "b",
        },
      },
    }),
  });

  await t.step({
    name: "ADD01",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        b: 11,
        c: "r",
      }),
      throws: true,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Add,
        left: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
        right: {
          kind: ExpressionKind.Reference,
          name: "c",
        },
      },
    }),
  });

  await t.step({
    name: "SUB00",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: 3,
        b: 2,
      }),
      result: 1,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Subtract,
        left: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
        right: {
          kind: ExpressionKind.Reference,
          name: "b",
        },
      },
    }),
  });

  await t.step({
    name: "SUB01",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: 100,
        b: 50,
        c: 25,
      }),
      result: 75,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Subtract,
        left: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
        right: {
          kind: ExpressionKind.Binary,
          op: BinaryOperation.Subtract,
          left: {
            kind: ExpressionKind.Reference,
            name: "b",
          },
          right: {
            kind: ExpressionKind.Reference,
            name: "c",
          },
        },
      },
    }),
  });

  await t.step({
    name: "MULTIPLY00",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: 7,
        b: 11,
      }),
      result: 77,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Multiply,
        left: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
        right: {
          kind: ExpressionKind.Reference,
          name: "b",
        },
      },
    }),
  });
});
