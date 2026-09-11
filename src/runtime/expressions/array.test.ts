import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { ArrayElementExpression } from "./expression.ts";

await Deno.test("runtime/expressions/array", async (t) => {
  await t.step({
    name: "RUNTIME.ARRAY00",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArrayElement,
            expression: {
              kind: ExpressionKind.Reference,
              name: "a",
            },
          },
          {
            kind: ExpressionKind.ArrayElement,
            expression: {
              kind: ExpressionKind.Reference,
              name: "b",
            },
          },
        ],
      },
      scope: Scope.Default().addVariables({
        a: 7,
        b: 11,
      }),
      result: [7, 11],
    }),
  });

  await t.step({
    name: "RUNTIME.ARRAY01",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [],
      },
      result: [],
    }),
  });

  await t.step({
    name: "RUNTIME.ARRAY02",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArrayElement,
            expression: {
              kind: ExpressionKind.Array,
              expressions: [
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Reference,
                    name: "a",
                  },
                },
              ],
            },
          },
        ],
      },
      scope: Scope.Default().addVariables({
        a: [],
      }),
      result: [[[]]],
    }),
  });

  await t.step({
    name: "RUNTIME.ARRAY03",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArraySpread,
            expression: {
              kind: ExpressionKind.Array,
              expressions: [
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Value,
                    value: 7,
                  },
                },
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Value,
                    value: 11,
                  },
                },
              ],
            },
          },
        ],
      },
      result: [7, 11],
    }),
  });

  await t.step({
    name: "RUNTIME.ARRAY04",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArrayElement,
            expression: {
              kind: ExpressionKind.Array,
              expressions: [
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Value,
                    value: 7,
                  },
                },
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Value,
                    value: 11,
                  },
                },
              ],
            },
          },
          {
            kind: ExpressionKind.ArraySpread,
            expression: {
              kind: ExpressionKind.Array,
              expressions: [
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Value,
                    value: 13,
                  },
                },
              ],
            },
          },
        ],
      },
      result: [[7, 11], 13],
    }),
  });

  await t.step({
    name: "RUNTIME.ARRAY05",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArrayElement,
            expression: {
              kind: ExpressionKind.Value,
              value: [],
            },
          },
          {
            kind: ExpressionKind.ArraySpread,
            expression: {
              kind: ExpressionKind.Array,
              expressions: [
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Value,
                    value: 7,
                  },
                },
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Value,
                    value: 11,
                  },
                },
              ],
            },
          },
        ],
      },
      result: [[], 7, 11],
    }),
  });

  await t.step({
    name: "RUNTIME.ARRAY06",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArraySpread,
            expression: {
              kind: ExpressionKind.Array,
              expressions: [
                {
                  kind: ExpressionKind.ArraySpread,
                  expression: {
                    kind: ExpressionKind.Array,
                    expressions: [
                      {
                        kind: ExpressionKind.ArrayElement,
                        expression: {
                          kind: ExpressionKind.Value,
                          value: 7,
                        },
                      },
                      {
                        kind: ExpressionKind.ArrayElement,
                        expression: {
                          kind: ExpressionKind.Value,
                          value: 11,
                        },
                      },
                    ],
                  },
                },
                {
                  kind: ExpressionKind.ArrayElement,
                  expression: {
                    kind: ExpressionKind.Value,
                    value: 13,
                  },
                },
              ],
            },
          },
        ],
      },
      result: [7, 11, 13],
    }),
  });

  await t.step({
    name: "RUNTIME.ARRAY07",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArrayElement,
            expression: {
              kind: ExpressionKind.Native,
              fn: () => Promise.resolve(7),
            },
          },
          {
            kind: ExpressionKind.ArrayElement,
            expression: {
              kind: ExpressionKind.Value,
              value: 11,
            },
          },
        ],
      },
      result: [7, 11],
    }),
  });

  await t.step({
    name: "RUNTIME.ARRAY08",
    fn: async () => {
      // Elements must be evaluated strictly left-to-right, not concurrently
      // (concurrent evaluation would race a shared parser scope/stream).
      const order: number[] = [];
      const delayed = (n: number, ms: number): ArrayElementExpression => ({
        kind: ExpressionKind.ArrayElement,
        expression: {
          kind: ExpressionKind.Native,
          fn: async () => {
            await new Promise((r) => setTimeout(r, ms));
            order.push(n);
            return n;
          },
        },
      });
      await expressionTest({
        expression: {
          kind: ExpressionKind.Array,
          expressions: [delayed(0, 20), delayed(1, 0)],
        },
        result: [0, 1],
      })();
      if (order[0] !== 0 || order[1] !== 1) {
        throw new Error(`Expected sequential order [0, 1], got [${order}]`);
      }
    },
  });

  await t.step({
    name: "RUNTIME.ARRAY09",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [
          {
            kind: ExpressionKind.ArraySpread,
            expression: {
              kind: ExpressionKind.Value,
              value: 7,
            },
          },
        ],
      },
      throws: true,
    }),
  });
});
