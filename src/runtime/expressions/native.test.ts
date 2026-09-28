import { assertEquals, assertStrictEquals } from "@std/assert";
import { ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { Scope } from "../scope.ts";
import { originOf, rootOrigin, Wrapped } from "../../wrapped.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { native } from "./native.ts";

Deno.test("runtime/expressions/native", async (t) => {
  const x = new Wrapped(7, rootOrigin(2));
  const scope = Scope.Default().addVariables({ x });
  const m = ok(scope, scope, { kind: PatternKind.Ok }, "v");

  await t.step("NATIVE00 - receives wrapped variables and `_`", async () => {
    const seen: Record<string, unknown>[] = [];
    await native({
      kind: ExpressionKind.Native,
      fn: (variables) => seen.push(variables),
    }, m);
    assertStrictEquals(seen[0].x, x);
    assertStrictEquals(seen[0]._, m.value);
  });

  await t.step(
    "NATIVE01 - a raw result takes the evaluating match's spans as origin",
    async () => {
      const r = await native({
        kind: ExpressionKind.Native,
        fn: ({ x }: { x: Wrapped<number> }) => x.raw + 1,
      }, m);
      assertEquals(r.raw, 8);
      assertEquals(r.origin, originOf(m));
    },
  );

  await t.step("NATIVE02 - a wrapped result is carried", async () => {
    const r = await native({
      kind: ExpressionKind.Native,
      fn: ({ x }: { x: Wrapped<number> }) => x,
    }, m);
    assertStrictEquals(r, x);
  });
});
