import { immediateExpressionTest } from "../../test.ts";
import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { ArrayElementExpression } from "./expression.ts";
import { assertEquals, assertStrictEquals } from "@std/assert";
import { originOf, rootOrigin, Wrapped } from "../../wrapped.ts";
import { type MatchOk, ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { exec } from "../exec.ts";

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

  await t.step({
    name: "ARRAY_IMMEDIATE - evaluates synchronously over immediate values",
    fn: immediateExpressionTest({
      expression: {
        kind: ExpressionKind.Array,
        expressions: [{
          kind: ExpressionKind.ArrayElement,
          expression: { kind: ExpressionKind.Number, value: 1 },
        }, {
          kind: ExpressionKind.ArraySpread,
          expression: { kind: ExpressionKind.Value, value: [2, 3] },
        }],
      },
      result: [1, 2, 3],
    }),
  });
});

function wrappedMatch(variables: Record<string, unknown> = {}): MatchOk {
  const scope = Scope.Default().addVariables(variables);
  return ok(scope, scope, { kind: PatternKind.Ok }, undefined);
}

Deno.test("runtime/expressions/array carries wrapped elements and takes the match's spans as origin", async () => {
  const x = new Wrapped(1, rootOrigin(2));
  const m = wrappedMatch({ x });
  const r = await exec({
    kind: ExpressionKind.Array,
    expressions: [{
      kind: ExpressionKind.ArrayElement,
      expression: { kind: ExpressionKind.Reference, name: "x" },
    }],
  }, m);
  assertStrictEquals((r.raw as unknown[])[0], x);
  assertEquals(r.origin, originOf(m));
});
