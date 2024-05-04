import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

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
});
