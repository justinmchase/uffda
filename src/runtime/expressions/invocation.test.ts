import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

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
});
