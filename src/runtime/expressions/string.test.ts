import { immediateExpressionTest } from "../../test.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { NativeExpression } from "./expression.ts";
import { assertEquals } from "@std/assert";
import { charOrigin, originOf, rootOrigin, Wrapped } from "../../wrapped.ts";
import { type MatchOk, ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { Scope } from "../scope.ts";
import { exec } from "../exec.ts";

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

  await t.step({
    name: "STRING_IMMEDIATE - evaluates synchronously over immediate values",
    fn: immediateExpressionTest({
      expression: {
        kind: ExpressionKind.String,
        values: ["a", { kind: ExpressionKind.Number, value: 1 }],
      },
      result: "a1",
    }),
  });
});

function wrappedMatch(variables: Record<string, unknown> = {}): MatchOk {
  const scope = Scope.Default().addVariables(variables);
  return ok(scope, scope, { kind: PatternKind.Ok }, undefined);
}

Deno.test("runtime/expressions/string keeps each interpolated character's provenance", async () => {
  const m = wrappedMatch({ x: new Wrapped("a", rootOrigin(6)) });
  const r = await exec({
    kind: ExpressionKind.String,
    values: [{ kind: ExpressionKind.Reference, name: "x" }, "!"],
  }, m) as Wrapped<string>;
  assertEquals(r.raw, "a!");
  assertEquals(charOrigin(r, 0), rootOrigin(6));
  assertEquals(charOrigin(r, 1), originOf(m));
});
