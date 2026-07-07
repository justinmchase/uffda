import { assert, assertEquals } from "@std/assert";
import { ok } from "../../mod.ts";
import { Scope } from "../../runtime/scope.ts";
import { exec } from "../../runtime/exec.ts";
import { BinaryOperation } from "../../runtime/expressions/expression.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";

Deno.test("req:expressions-runtime-008 - Composite expression evaluation preserves awaitable propagation and synchronous fast paths", async (t) => {
  const scope = Scope.Default();
  const match = ok(scope, scope, { kind: PatternKind.Ok }, undefined);

  await t.step(
    "exec returns a promise for composite expressions with immediate children",
    async () => {
      const binaryResult = exec(
        {
          kind: ExpressionKind.Binary,
          op: BinaryOperation.And,
          left: { kind: ExpressionKind.Value, value: true },
          right: { kind: ExpressionKind.Value, value: true },
        },
        match,
      );
      assert(binaryResult instanceof Promise);
      assertEquals(await binaryResult, true);

      const arrayResult = exec(
        {
          kind: ExpressionKind.Array,
          expressions: [
            {
              kind: ExpressionKind.ArrayElement,
              expression: { kind: ExpressionKind.Value, value: 7 },
            },
            {
              kind: ExpressionKind.ArrayElement,
              expression: { kind: ExpressionKind.Value, value: 11 },
            },
          ],
        },
        match,
      );
      assert(arrayResult instanceof Promise);
      assertEquals(await arrayResult, [7, 11]);

      const objectResult = exec(
        {
          kind: ExpressionKind.Object,
          keys: [
            {
              kind: ExpressionKind.ObjectKey,
              name: "x",
              expression: { kind: ExpressionKind.Value, value: 7 },
            },
            {
              kind: ExpressionKind.ObjectKey,
              name: "y",
              expression: { kind: ExpressionKind.Value, value: 11 },
            },
          ],
        },
        match,
      );
      assert(objectResult instanceof Promise);
      assertEquals(await objectResult, { x: 7, y: 11 });
    },
  );

  await t.step(
    "exec returns a promise for composite expressions with awaitable children",
    async () => {
      const binaryResult = exec(
        {
          kind: ExpressionKind.Binary,
          op: BinaryOperation.Or,
          left: {
            kind: ExpressionKind.Native,
            fn: () => Promise.resolve(false),
          },
          right: { kind: ExpressionKind.Value, value: true },
        },
        match,
      );
      assert(binaryResult instanceof Promise);
      assertEquals(await binaryResult, true);

      const stringResult = exec(
        {
          kind: ExpressionKind.String,
          values: [
            "a",
            {
              kind: ExpressionKind.Native,
              fn: () => Promise.resolve(1),
            },
            {
              kind: ExpressionKind.Value,
              value: 2,
            },
          ],
        },
        match,
      );
      assert(stringResult instanceof Promise);
      assertEquals(await stringResult, "a12");

      const notResult = exec(
        {
          kind: ExpressionKind.Not,
          expression: {
            kind: ExpressionKind.Native,
            fn: () => Promise.resolve(true),
          },
        },
        match,
      );
      assert(notResult instanceof Promise);
      assertEquals(await notResult, false);
    },
  );
});
