import { assertEquals, assertRejects } from "@std/assert";
import { MatchKind, ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { DefaultModule } from "../modules/module.ts";
import type { Func } from "../modules/func.ts";
import { Scope } from "../scope.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { funcCallable } from "./func_callable.ts";

Deno.test("runtime/expressions/func_callable", async (t) => {
  const identityFn: Func = {
    name: "Identity",
    module: DefaultModule(),
    pattern: { kind: PatternKind.End },
    expression: { kind: ExpressionKind.Reference, name: "this" },
  };

  await t.step(
    "FUNC_CALLABLE00 - without a subject, `this` resolves to the args-match",
    async () => {
      const scope = Scope.Default();
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const invoke = funcCallable(identityFn, m);
      const result = await invoke();
      assertEquals((result as { kind: MatchKind }).kind, MatchKind.Ok);
    },
  );

  await t.step(
    "FUNC_CALLABLE01 - with a subject, `this` rebinds to that subject",
    async () => {
      const scope = Scope.Default();
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const subject = { name: "Example" };
      const invoke = funcCallable(identityFn, m, subject);
      const result = await invoke();
      assertEquals(result, subject);
    },
  );

  await t.step(
    "FUNC_CALLABLE02 - argument mismatch against the func's pattern throws",
    async () => {
      const scope = Scope.Default();
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const invoke = funcCallable(identityFn, m);
      await assertRejects(
        () => invoke("unexpected-extra-argument"),
        Error,
        "arguments did not match parameter pattern",
      );
    },
  );
});
