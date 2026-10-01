import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import { type Match, MatchKind, ok } from "../../match.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import type { Pattern } from "../patterns/pattern.ts";
import { DefaultModule } from "../modules/module.ts";
import type { Func } from "../modules/func.ts";
import { Scope } from "../scope.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { argsPattern, funcCallable } from "./func_callable.ts";
import { isWrapped, rawOf } from "../../wrapped.ts";

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
      assert(isWrapped(result));
      assertEquals((rawOf(result) as { kind: MatchKind }).kind, MatchKind.Ok);
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
      assertStrictEquals(rawOf(result), subject);
    },
  );

  await t.step(
    "FUNC_CALLABLE02 - argument mismatch against the func's pattern throws",
    async () => {
      const scope = Scope.Default();
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const invoke = funcCallable(identityFn, m);
      await assertRejects(
        async () => await invoke("unexpected-extra-argument"),
        Error,
        "arguments did not match parameter pattern",
      );
    },
  );

  await t.step(
    "FUNC_CALLABLE03 - the args pattern is derived once per func pattern",
    () => {
      const pattern = { kind: PatternKind.Any } as const;
      const derived = argsPattern(pattern);
      assertStrictEquals(argsPattern(pattern), derived);
      assertEquals(derived, {
        kind: PatternKind.Then,
        patterns: [pattern, { kind: PatternKind.End }],
      });
      const end = { kind: PatternKind.End } as const;
      assertStrictEquals(argsPattern(end), end);
    },
  );

  await t.step(
    "FUNC_CALLABLE04 - repeated calls compile the args pattern only once",
    async () => {
      const scope = Scope.Default();
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const fn: Func = { ...identityFn, pattern: { kind: PatternKind.Any } };
      const invoke = funcCallable(fn, m);
      let builds = 0;
      const { resolver } = scope.options;
      const compile = resolver.compilePattern.bind(resolver);
      resolver.compilePattern = (p: Pattern, build: () => CompiledPattern) =>
        compile(p, () => {
          builds++;
          return build();
        });
      await invoke(1);
      const first = builds;
      await invoke(2);
      await invoke(3);
      assertEquals(builds, first);
    },
  );

  await t.step(
    "FUNC_CALLABLE05 - parameters do not see or collide with caller variables",
    async () => {
      const scope = Scope.Default().addVariables({ x: "caller", y: "hidden" });
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const fn: Func = {
        name: "Echo",
        module: DefaultModule(),
        pattern: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: { kind: PatternKind.Any },
        },
        expression: { kind: ExpressionKind.Reference, name: "x" },
      };
      assertEquals(rawOf(await funcCallable(fn, m)("arg")), "arg");
      const leak: Func = {
        ...fn,
        expression: { kind: ExpressionKind.Reference, name: "y" },
      };
      await assertRejects(
        async () => await funcCallable(leak, m)("arg"),
        ReferenceError,
        "unknown reference: y",
      );
    },
  );

  await t.step(
    "FUNC_CALLABLE06 - the body resolves funcs from its declaring module",
    async () => {
      const home = DefaultModule();
      const helper: Func = {
        name: "Helper",
        module: home,
        pattern: { kind: PatternKind.End },
        expression: { kind: ExpressionKind.Reference, name: "this" },
      };
      home.funcs.set("Helper", helper);
      const outer: Func = {
        name: "Outer",
        module: home,
        pattern: { kind: PatternKind.End },
        expression: {
          kind: ExpressionKind.Invocation,
          expression: { kind: ExpressionKind.Reference, name: "Helper" },
          args: [],
        },
      };
      const scope = Scope.Default();
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const result = rawOf(await funcCallable(outer, m)()) as Match;
      assertStrictEquals(result.scope.module, home);
    },
  );

  await t.step(
    "FUNC_CALLABLE07 - a parameter pattern error is raised, not returned",
    async () => {
      const scope = Scope.Default();
      const m = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const fn: Func = {
        ...identityFn,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Variable,
              name: "a",
              pattern: { kind: PatternKind.Any },
            },
            {
              kind: PatternKind.Variable,
              name: "a",
              pattern: { kind: PatternKind.Any },
            },
          ],
        },
      };
      await assertRejects(
        async () => await funcCallable(fn, m)(1, 2),
        Error,
        "Variable a already exists in scope",
      );
    },
  );
});
