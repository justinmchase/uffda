import {
  assert,
  assertEquals,
  assertObjectMatch,
  assertStrictEquals,
} from "@std/assert";
import { lit, ResolveTargetKind } from "./patterns/pattern.ts";
import { match } from "./match.ts";
import { PatternKind } from "./patterns/mod.ts";
import { Scope } from "./scope.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import { MatchKind, ok } from "../match.ts";
import { exec } from "./exec.ts";
import { Path } from "../path.ts";
import { ExpressionKind } from "./expressions/mod.ts";
import type { Pattern } from "./patterns/mod.ts";
import type { Expression } from "./expressions/mod.ts";
import { StackFrameKind } from "./stack/stackFrameKind.ts";
import { unwrap } from "../wrapped.ts";

Deno.test("runtime.scope", async (t) => {
  await t.step({
    name: "SCOPE00",
    fn: async () => {
      const scope = Scope.From("abc", {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Ok);
      const done = await m.scope.stream.done();
      const { start, end } = m.span;
      assertObjectMatch({ done, start, end }, {
        done: false,
        start: Path.From(0),
        end: Path.From(2),
      });
    },
  });

  await t.step({
    name: "SCOPE01",
    fn: async () => {
      const scope = Scope.From("ab", {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = { kind: PatternKind.Equal, value: lit("a") };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Ok);
      const done = await m.scope.stream.done();
      const { start, end } = m.span;
      // It matched the full pattern but didn't consume all of the output
      assertEquals({ done, start, end }, {
        done: false,
        start: Path.From(0),
        end: Path.From(1),
      });
    },
  });

  await t.step({
    name: "SCOPE02",
    fn: async () => {
      const scope = Scope.From("abc", {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Ok);
      const done = await m.scope.stream.done();
      const { start, end } = m.span;
      assertObjectMatch({ done, start, end }, {
        done: true,
        start: Path.From(0),
        end: Path.From(3),
      });
    },
  });

  await t.step({
    name: "SCOPE03",
    fn: async () => {
      // patterns can't resolve global references
      const scope = Scope
        .Default()
        .withInput(Input.Iterable(""))
        .withOptions({
          globals: new Map([
            ["x", 7],
          ]),
        });
      const pattern: Pattern = {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "x",
        args: [],
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Error, `Expected fail but got ${m.kind}`);
    },
  });

  await t.step({
    name: "SCOPE04",
    fn: async () => {
      // expressions can resolve globals
      const scope = Scope.Default()
        .withInput(Input.Iterable("a"))
        .withOptions({
          globals: new Map([
            ["x", 7],
          ]),
        });
      const match = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      const expression: Expression = {
        kind: ExpressionKind.Reference,
        name: "x",
      };
      const result = await exec(expression, match);
      assertEquals(unwrap(result), 7);
    },
  });

  await t.step({
    name: "SCOPE05",
    fn: async () => {
      // expressions can resolve globals
      const scope = Scope.From("a", {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = { kind: PatternKind.Equal, value: lit("x") };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Fail);
      const done = await m.scope.stream.done();
      const { start, end } = m.span;
      assertEquals({ done, start, end }, {
        done: false,
        start: Path.From(0),
        end: Path.From(0),
      });
    },
  });

  await t.step({
    name: "SCOPE06",
    fn: async () => {
      const scope = Scope.From("abc");
      const pattern: Pattern = { kind: PatternKind.Equal, value: lit("abc") };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Ok);
      assertEquals(await m.scope.stream.done(), true);
      assertEquals(m.span.start, Path.From(0));
      assertEquals(m.span.end, Path.From(1));
    },
  });

  await t.step({
    name: "SCOPE_STACK_SHARED",
    fn: () => {
      const scope = Scope.Default();
      const pipeline: Pattern = { kind: PatternKind.Ok };
      const outer = scope.pushPipeline(pipeline);
      const inner = outer.pushPipeline(pipeline);
      assertEquals(scope.depth, 0);
      assertEquals(outer.depth, 1);
      assertEquals(inner.depth, 2);
      assertStrictEquals(inner.stack.parent, outer.stack);
      assertStrictEquals(inner.stack.top?.kind, StackFrameKind.Pipeline);
      assertStrictEquals(inner.withInput(Input.Default()).stack, inner.stack);
    },
  });

  await t.step({
    name: "SCOPE_OPTIONS_SHARED",
    fn: () => {
      const scope = Scope.Default();
      const pipeline: Pattern = { kind: PatternKind.Ok };
      assertStrictEquals(
        scope.withInput(Input.Default()).options,
        scope.options,
      );
      assertStrictEquals(scope.addVariables({ x: 1 }).options, scope.options);
      assertStrictEquals(scope.pushPipeline(pipeline).options, scope.options);
      assertStrictEquals(
        scope.pop(scope.pushPipeline(pipeline)).options,
        scope.options,
      );
      const traced = scope.withOptions({ trace: true });
      assert(traced.options !== scope.options);
      assertEquals(traced.options.trace, true);
      assertStrictEquals(traced.options.resolver, scope.options.resolver);
    },
  });

  await t.step({
    name: "SCOPE_ADD_VARIABLE",
    fn: () => {
      const scope = Scope.Default().addVariables({ a: 1 });
      const next = scope.addVariable("b", 2);
      assertEquals(next.variables.get("a"), 1);
      assertEquals(next.variables.get("b"), 2);
      assertEquals(scope.variables.has("b"), false);
      assertStrictEquals(next.stream, scope.stream);
      assertStrictEquals(next.stack, scope.stack);
      assertStrictEquals(next.options, scope.options);
    },
  });

  await t.step({
    name: "SCOPE_OPTIONS_PARTIAL",
    fn: () => {
      const scope = new Scope(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { trace: true },
      );
      assertEquals(scope.options.trace, true);
      assert(scope.options.resolver !== undefined);
      assert(scope.options.specials instanceof Map);
    },
  });
});

Deno.test("runtime.scope recovery", async (t) => {
  await t.step({
    name:
      "SCOPE_RECOVERY - recovery is disabled by default and carried through derivations",
    fn: () => {
      const scope = Scope.Default();
      assertEquals(scope.recovery, false);
      assertStrictEquals(scope.withRecovery(false), scope);
      const recovering = scope.withRecovery(true);
      assertEquals(recovering.recovery, true);
      assertStrictEquals(recovering.options, scope.options);
      assertEquals(recovering.withInput(Input.Default()).recovery, true);
      assertEquals(recovering.withOptions({ trace: true }).recovery, true);
      assertEquals(recovering.addVariable("x", 1).recovery, true);
    },
  });
});
