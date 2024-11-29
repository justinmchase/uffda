import { expressionTest } from "../../test.ts";
import { BinaryOperation } from "./expression.ts";
import { ExpressionKind } from "./expression.kind.ts";

await Deno.test("runtime/patterns/binary", async (t) => {
  await t.step({
    name: "AND00",
    fn: expressionTest({
      result: true,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.And,
        left: {
          kind: ExpressionKind.Value,
          value: true,
        },
        right: {
          kind: ExpressionKind.Value,
          value: true,
        },
      },
    }),
  });

  await t.step({
    name: "AND01",
    fn: expressionTest({
      result: false,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.And,
        left: {
          kind: ExpressionKind.Value,
          value: true,
        },
        right: {
          kind: ExpressionKind.Value,
          value: false,
        },
      },
    }),
  });

  await t.step({
    name: "OR00",
    fn: expressionTest({
      result: true,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Or,
        left: {
          kind: ExpressionKind.Value,
          value: true,
        },
        right: {
          kind: ExpressionKind.Value,
          value: true,
        },
      },
    }),
  });

  await t.step({
    name: "OR01",
    fn: expressionTest({
      result: true,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Or,
        left: {
          kind: ExpressionKind.Value,
          value: false,
        },
        right: {
          kind: ExpressionKind.Value,
          value: true,
        },
      },
    }),
  });

  await t.step({
    name: "OR02",
    fn: expressionTest({
      result: false,
      expression: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Or,
        left: {
          kind: ExpressionKind.Value,
          value: false,
        },
        right: {
          kind: ExpressionKind.Value,
          value: false,
        },
      },
    }),
  });
});
