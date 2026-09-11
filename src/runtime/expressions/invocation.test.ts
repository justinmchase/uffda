import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { Expression } from "./expression.ts";

Deno.test("runtime.expressions.invocation", async (t) => {
  await t.step({
    name: "INVOKE00",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "fn",
        },
        args: [
          {
            kind: ExpressionKind.Reference,
            name: "a",
          },
          {
            kind: ExpressionKind.Reference,
            name: "b",
          },
        ],
      },
      scope: Scope
        .Default()
        .withOptions({
          globals: new Map([
            ["fn", (a: number, b: number) => a + b],
          ]),
        })
        .addVariables({
          a: 7,
          b: 11,
        }),
      result: 18,
    }),
  });

  await t.step({
    name: "INVOKE01",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "fn",
        },
        args: [],
      },
      scope: Scope
        .Default()
        .withOptions({
          globals: new Map([
            ["fn", () => "uffda"],
          ]),
        }),
      result: "uffda",
    }),
  });

  await t.step({
    name: "INVOKE02",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "fn",
        },
        args: [],
      },
      scope: Scope
        .Default()
        .withOptions({
          globals: new Map([
            ["fn", () => "one"],
          ]),
        })
        .addVariables({
          // The locally scoped variable should resolve rather than the global
          fn: () => "two",
        }),
      result: "two",
    }),
  });

  await t.step({
    name: "INVOKE03",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "fn",
        },
        args: [{ kind: ExpressionKind.Value, value: 7 }],
      },
      scope: Scope
        .Default()
        .withOptions({
          globals: new Map([
            ["fn", (v: number) => Promise.resolve(v + 1)],
          ]),
        }),
      result: 8,
    }),
  });

  await t.step({
    name: "INVOKE04",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "fn",
        },
        args: [
          {
            kind: ExpressionKind.Native,
            fn: () => Promise.resolve(11),
          },
        ],
      },
      scope: Scope
        .Default()
        .withOptions({
          globals: new Map([
            ["fn", (v: number) => v * 2],
          ]),
        }),
      result: 22,
    }),
  });

  await t.step({
    name: "INVOKE05",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "fn",
        },
        args: [
          {
            kind: ExpressionKind.Value,
            value: 1,
          },
          {
            kind: ExpressionKind.InvocationSpread,
            expression: {
              kind: ExpressionKind.Reference,
              name: "rest",
            },
          },
        ],
      },
      scope: Scope
        .Default()
        .withOptions({
          globals: new Map([
            ["fn", (...args: unknown[]) => args],
          ]),
        })
        .addVariables({
          rest: [2, 3],
        }),
      result: [1, 2, 3],
    }),
  });

  await t.step({
    name: "INVOKE06",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Value,
          value: 7,
        },
        args: [],
      },
      throws: true,
    }),
  });

  await t.step({
    name: "INVOKE07",
    fn: expressionTest({
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "fn",
        },
        args: [
          {
            kind: ExpressionKind.InvocationSpread,
            expression: {
              kind: ExpressionKind.Value,
              value: 11,
            },
          },
        ],
      },
      scope: Scope
        .Default()
        .withOptions({
          globals: new Map([
            ["fn", (...args: unknown[]) => args],
          ]),
        }),
      throws: true,
    }),
  });

  await t.step({
    name: "INVOKE08",
    fn: async () => {
      // Arguments must be evaluated strictly left-to-right, not
      // concurrently (concurrent evaluation would race a shared parser
      // scope/stream).
      const order: number[] = [];
      const delayed = (n: number, ms: number): Expression => ({
        kind: ExpressionKind.Native,
        fn: async () => {
          await new Promise((r) => setTimeout(r, ms));
          order.push(n);
          return n;
        },
      });
      await expressionTest({
        expression: {
          kind: ExpressionKind.Invocation,
          expression: {
            kind: ExpressionKind.Reference,
            name: "fn",
          },
          args: [delayed(0, 20), delayed(1, 0)],
        },
        scope: Scope
          .Default()
          .withOptions({
            globals: new Map([
              ["fn", (...args: unknown[]) => args],
            ]),
          }),
        result: [0, 1],
      })();
      if (order[0] !== 0 || order[1] !== 1) {
        throw new Error(`Expected sequential order [0, 1], got [${order}]`);
      }
    },
  });
});
