import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import fixtures from "./globals-fixtures.json" with { type: "json" };
import { ok } from "../../src/match.ts";
import { exec } from "../../src/runtime/exec.ts";
import { ExpressionKind } from "../../src/runtime/expressions/expression.kind.ts";
import {
  type Expression,
  isExpression,
} from "../../src/runtime/expressions/expression.ts";
import { assert } from "@std/assert";
import { PatternKind } from "../../src/runtime/patterns/pattern.kind.ts";
import { Scope } from "../../src/runtime/scope.ts";
import { unwrap, Wrapped } from "../../src/wrapped.ts";
import { format } from "../../src/runtime/globals/format.ts";
import { iterable } from "../../src/runtime/globals/iterable.ts";
import { defaultGlobals } from "../../src/runtime/globals/mod.ts";
import { at } from "../../src/runtime/globals/at.ts";
import { slice } from "../../src/runtime/globals/slice.ts";

Deno.test("req:expressions-runtime-005 req:expressions-runtime-007 - shared Rust native globals fixtures", async (t) => {
  for (const fixture of fixtures) {
    await t.step(fixture.name, async () => {
      const scope = Scope.Default();
      const match = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      let ast: Expression = {
        kind: ExpressionKind.Invocation,
        expression: { kind: ExpressionKind.Reference, name: fixture.name },
        args: ("args" in fixture ? fixture.args ?? [] : []).map((value) => ({
          kind: ExpressionKind.Value,
          value,
        })),
      };
      if ("expressions" in fixture) {
        const expressions = fixture.expressions ?? [];
        for (const expression of expressions) assert(isExpression(expression));
        ast.args = expressions as Expression[];
      }
      if ("spread" in fixture && fixture.spread) {
        ast = {
          kind: ExpressionKind.Array,
          expressions: [{ kind: ExpressionKind.ArraySpread, expression: ast }],
        };
      }
      if ("error" in fixture && fixture.error) {
        await assertRejects(async () => await exec(ast, match));
      } else {
        assertEquals(unwrap(await exec(ast, match)), fixture.expected);
      }
    });
  }
});

Deno.test("req:runtime-core-012 - recursive arrays reject implicit conversion", () => {
  const cyclic: unknown[] = [];
  cyclic.push(cyclic, 1, cyclic);
  assertThrows(() => format("{0}", cyclic), TypeError);
  const mutual: unknown[] = [];
  const nested = [2, mutual, 3];
  mutual.push(1, nested, 4);
  assertThrows(() => format("{0}", mutual), TypeError);
  assertThrows(() => format("{0}", [nested, nested]), TypeError);
});

Deno.test("req:expressions-runtime-003 - missing compiled literal value stays undefined rather than null", async () => {
  const scope = Scope.Default();
  const match = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
  const missing = { kind: ExpressionKind.Value };
  assert(isExpression(missing));
  assertEquals(unwrap(await exec(missing, match)), undefined);
  assertEquals(
    unwrap(await exec({ kind: ExpressionKind.Value, value: null }, match)),
    null,
  );
});

Deno.test("req:expressions-runtime-005 - native callable own properties are source-defined", () => {
  const arities = [
    2,
    2,
    1,
    0,
    2,
    2,
    1,
    2,
    2,
    1,
    1,
    2,
    2,
    2,
    1,
    1,
    1,
    2,
    1,
    2,
    1,
    2,
    2,
    2,
    1,
    2,
    0,
    2,
    3,
    3,
    1,
    3,
    2,
    1,
    1,
    3,
  ];
  for (
    const [[name, value], arity] of [...defaultGlobals].map((entry, i) =>
      [entry, arities[i]] as const
    )
  ) {
    assertEquals((value as { name: string }).name, name);
    assertEquals((value as { length: number }).length, arity);
  }
});

Deno.test("req:expressions-runtime-005 - UTF16 operations can produce lone surrogate strings", () => {
  assertEquals(at("😀", 0), "\ud83d");
  assertEquals(slice("😀", 1, 2), "\ude00");
  assertEquals(JSON.parse('"\\ud83d"'), "\ud83d");
});

Deno.test("req:expressions-runtime-007 - authored iterator next retains its wrapped result record", async () => {
  const scope = Scope.Default();
  const match = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
  for (const value of [{ done: true, value: 42 }, 42]) {
    const next = unwrap(
      await exec({
        kind: ExpressionKind.Lambda,
        pattern: { kind: PatternKind.End },
        expression: { kind: ExpressionKind.Value, value },
      }, match),
    ) as () => Promise<unknown>;
    const source = {
      [Symbol.asyncIterator]: () => ({ next }),
    };
    const stream = iterable(new Wrapped(source, match.originalSpan));
    const iterator = stream[Symbol.asyncIterator]();
    const first = await iterator.next();
    assertEquals(first.done, false);
    assertEquals(unwrap(first.value), undefined);
    await iterator.return?.();
  }
});

Deno.test("req:runtime-core-012 - callable coercion never exposes host source text", () => {
  const add = defaultGlobals.get("add");
  assertThrows(() => format("{0}", add), TypeError);
});
