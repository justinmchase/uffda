import { immediateExpressionTest } from "../../test.ts";
import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { DefaultModule } from "../modules/module.ts";
import type { Rule } from "../modules/rule.ts";
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

  await t.step(
    "REFERENCE_RULE - a rule name resolves to its rule info, after variables",
    () => {
      const module = DefaultModule();
      const rule: Rule = {
        name: "Format",
        module,
        parameters: [{ name: "W" }],
        pattern: { kind: PatternKind.Ok },
      };
      module.rules.set("Format", rule);
      const argument: Rule = { ...rule, name: "Argument" };
      const scope = new Scope(
        module,
        undefined,
        new Map(),
        new Map([["L", argument]]),
      );
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const ref = (name: string) =>
        resolveReference({ kind: ExpressionKind.Reference, name }, m);
      assertEquals(ref("Format"), {
        kind: "rule",
        name: "Format",
        moduleUrl: module.moduleUrl.href,
        parameters: ["W"],
      });
      assertThrows(() => ref("L"), ReferenceError, "unknown reference: L");
      const shadowed = ok(
        scope.addVariable("Format", 1),
        scope.addVariable("Format", 1),
        { kind: PatternKind.Ok },
        undefined,
      );
      assertEquals(
        resolveReference(
          { kind: ExpressionKind.Reference, name: "Format" },
          shadowed,
        ),
        1,
      );
    },
  );
});
