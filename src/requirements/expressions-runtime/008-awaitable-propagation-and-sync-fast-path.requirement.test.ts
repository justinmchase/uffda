import { assert, assertEquals } from "@std/assert";
import { ok } from "../../match.ts";
import { Scope } from "../../runtime/scope.ts";
import { exec } from "../../runtime/exec.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { unwrap } from "../../wrapped.ts";

Deno.test("req:expressions-runtime-008 - Exec completes synchronously for immediate children and propagates awaitables otherwise", async (t) => {
  const scope = Scope.Default();
  const match = ok(scope, scope, { kind: PatternKind.Ok }, undefined);

  await t.step(
    "exec returns the value itself for composite expressions with immediate children",
    () => {
      const stringImmediateResult = exec(
        {
          kind: ExpressionKind.String,
          values: [
            "a",
            { kind: ExpressionKind.Value, value: 1 },
          ],
        },
        match,
      );
      assertEquals(unwrap(stringImmediateResult), "a1");

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
      assertEquals(unwrap(arrayResult), [7, 11]);

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
      assertEquals(unwrap(objectResult), { x: 7, y: 11 });
    },
  );

  await t.step(
    "exec returns a promise for composite expressions with any awaitable child",
    async () => {
      const arrayAwaitableResult = exec(
        {
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
              expression: { kind: ExpressionKind.Value, value: 11 },
            },
          ],
        },
        match,
      );
      assert(arrayAwaitableResult instanceof Promise);
      assertEquals(unwrap(await arrayAwaitableResult), [7, 11]);

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
      assertEquals(unwrap(await stringResult), "a12");

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
      assertEquals(unwrap(await notResult), false);
    },
  );

  await t.step(
    "children are evaluated in declared order across an awaitable child",
    async () => {
      const order: string[] = [];
      const record = (name: string, value: unknown) => ({
        kind: ExpressionKind.ArrayElement as const,
        expression: {
          kind: ExpressionKind.Native as const,
          fn: () => {
            order.push(name);
            return value;
          },
        },
      });
      const result = exec(
        {
          kind: ExpressionKind.Array,
          expressions: [
            record("a", 1),
            record("b", Promise.resolve(2)),
            record("c", 3),
          ],
        },
        match,
      );
      assert(result instanceof Promise);
      assertEquals(unwrap(await result), [1, 2, 3]);
      assertEquals(order, ["a", "b", "c"]);
    },
  );
});
