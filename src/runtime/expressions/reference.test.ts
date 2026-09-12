import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { assertEquals } from "@std/assert";
import { ok } from "../../match.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { exec } from "../exec.ts";

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
      assertEquals(r, m);
    },
  );
});
