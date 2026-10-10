import { assert, assertEquals } from "@std/assert";
import fixtures from "./expression-fixtures.json" with { type: "json" };
import { ok } from "../../src/match.ts";
import { exec } from "../../src/runtime/exec.ts";
import { isExpression } from "../../src/runtime/expressions/expression.ts";
import { PatternKind } from "../../src/runtime/patterns/pattern.kind.ts";
import { Scope } from "../../src/runtime/scope.ts";
import { unwrap } from "../../src/wrapped.ts";

Deno.test("req:expressions-runtime-003 req:expressions-runtime-004 req:expressions-runtime-005 req:expressions-runtime-006 req:expressions-runtime-007 - shared Rust expression fixtures", async (t) => {
  for (const fixture of fixtures) {
    await t.step(fixture.name, async () => {
      assert(isExpression(fixture.ast));
      const scope = Scope.Default();
      const match = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
      assertEquals(unwrap(await exec(fixture.ast, match)), fixture.expected);
    });
  }
});
