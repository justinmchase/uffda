import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { NativeExpression } from "./expression.ts";

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

  await t.step({
    name: "STRING02",
    fn: expressionTest({
      result: "abc11xyz",
      expression: {
        kind: ExpressionKind.String,
        values: [
          "abc",
          {
            kind: ExpressionKind.Native,
            fn: () => Promise.resolve(11),
          },
          "xyz",
        ],
      },
    }),
  });

  await t.step({
    name: "STRING03",
    fn: async () => {
      // Interpolated segments must be evaluated strictly left-to-right, not
      // concurrently (concurrent evaluation would race a shared parser
      // scope/stream).
      const order: number[] = [];
      const delayed = (n: number, ms: number): NativeExpression => ({
        kind: ExpressionKind.Native,
        fn: async () => {
          await new Promise((r) => setTimeout(r, ms));
          order.push(n);
          return n;
        },
      });
      await expressionTest({
        expression: {
          kind: ExpressionKind.String,
          values: [delayed(0, 20), delayed(1, 0)],
        },
        result: "01",
      })();
      if (order[0] !== 0 || order[1] !== 1) {
        throw new Error(`Expected sequential order [0, 1], got [${order}]`);
      }
    },
  });
});
