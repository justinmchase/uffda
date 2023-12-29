import { Match } from "../../match.ts";
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
      match: Match.Default(
        Scope.Default()
          .withOptions({
            globals: new Map([
              ["fn", (a: number, b: number) => a + b],
            ]),
          })
          .addVariables({
            a: 7,
            b: 11,
          }),
      ),
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
      match: Match.Default(
        Scope.Default()
          .withOptions({
            globals: new Map([
              ["fn", () => "uffda"],
            ]),
          }),
      ),
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
      match: Match.Default(
        Scope.Default()
          .withOptions({
            globals: new Map([
              ["fn", () => "one"],
            ]),
          })
          .addVariables({
            // The locally scoped variable should resolve rather than the global
            fn: () => "two",
          }),
      ),
      result: "two",
    }),
  });
});
