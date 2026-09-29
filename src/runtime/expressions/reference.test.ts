import { immediateExpressionTest } from "../../test.ts";
import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { assertEquals, assertStrictEquals } from "@std/assert";
import { ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { exec } from "../exec.ts";
import { reference, resolveReference } from "./reference.ts";
import { rawOf, unwrap } from "../../wrapped.ts";

await Deno.test("runtime/expressions/reference", async (t) => {
  await t.step({
    name: "REFERENCE00",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: 7,
      }),
      result: 7,
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
    }),
  });

  await t.step({
    name: "REFERENCE01",
    fn: expressionTest({
      scope: Scope.Default().addVariables({
        a: 7,
        b: 11,
      }),
      result: 11,
      expression: {
        kind: ExpressionKind.Reference,
        name: "b",
      },
    }),
  });

  await t.step({
    name: "REFERENCE02",
    fn: expressionTest({
      scope: Scope.Default(),
      throws: true,
      expression: {
        kind: ExpressionKind.Reference,
        name: "missing",
      },
    }),
  });

  await t.step(
    "REFERENCE03 - `this` resolves to the current MatchOk",
    async () => {
      const scope = Scope.Default();
      const m = ok(scope, scope, { kind: PatternKind.Ok }, "value");
      const r = await exec(
        { kind: ExpressionKind.Reference, name: "this" },
        m,
      );
      assertStrictEquals(rawOf(r), m);
    },
  );

  await t.step(
    "REFERENCE04 - `this` resolves to match.subject when set",
    async () => {
      const scope = Scope.Default();
      const subject = { name: "Example" };
      const m = ok(scope, scope, { kind: PatternKind.Ok }, "value");
      const r = await exec(
        { kind: ExpressionKind.Reference, name: "this" },
        { ...m, subject },
      );
      assertEquals(unwrap(r), subject);
    },
  );

  await t.step({
    name: "REFERENCE_IMMEDIATE - evaluates synchronously over immediate values",
    fn: immediateExpressionTest({
      scope: Scope.Default().addVariables({ x: 1 }),
      expression: { kind: ExpressionKind.Reference, name: "x" },
      result: 1,
    }),
  });

  await t.step(
    "REFERENCE_RESOLVE - resolveReference returns the stored value unwrapped",
    () => {
      const join = (...parts: unknown[]) => parts.join("");
      const scope = Scope.Default()
        .withOptions({ globals: new Map([["join", join]]) })
        .addVariables({ x: 1 });
      const m = ok(scope, scope, { kind: PatternKind.Ok }, "value");
      assertStrictEquals(
        resolveReference({ kind: ExpressionKind.Reference, name: "join" }, m),
        join,
      );
      assertStrictEquals(
        resolveReference({ kind: ExpressionKind.Reference, name: "this" }, m),
        m,
      );
      assertStrictEquals(
        resolveReference({ kind: ExpressionKind.Reference, name: "_" }, m),
        m.value,
      );
      const wrapped = reference(
        { kind: ExpressionKind.Reference, name: "join" },
        m,
      );
      assertStrictEquals(wrapped.raw, join);
      assertEquals(wrapped.origin, m.originalSpan);
    },
  );
});
