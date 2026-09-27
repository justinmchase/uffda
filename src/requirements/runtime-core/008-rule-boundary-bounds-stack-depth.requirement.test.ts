import { assert, assertEquals } from "@std/assert";
import { rule } from "../../runtime/rule.ts";
import { Scope } from "../../runtime/scope.ts";
import { DefaultModule } from "../../runtime/modules/module.ts";
import type { Rule } from "../../runtime/modules/rule.ts";
import { InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";

Deno.test("req:runtime-core-008 - Fresh rule evaluation begins asynchronously so host stack depth does not grow with input nesting", async (t) => {
  await t.step(
    "a fresh rule invocation returns a promise and defers its body",
    async () => {
      let started = false;
      const r: Rule = {
        name: "Any",
        module: DefaultModule(),
        parameters: [],
        pattern: {
          kind: PatternKind.And,
          patterns: [
            {
              kind: PatternKind.Projection,
              pattern: { kind: PatternKind.Ok },
              expression: {
                kind: ExpressionKind.Native,
                fn: () => {
                  started = true;
                },
              },
            },
            { kind: PatternKind.Any },
          ],
        },
      };
      const scope = Scope.From("a", { kind: InputNormalizationMode.Iterable });
      const result = rule(r, new Map(), scope);
      assert(result instanceof Promise);
      assertEquals(started, false);
      assertEquals((await result).kind, MatchKind.Ok);
      assertEquals(started, true);
    },
  );

  await t.step(
    "a directly recursive grammar matches deeply nested input",
    async () => {
      const depth = 5000;
      const m = await executeUffdaSource(
        `export rule P = ("(" P ")") | "x";\n`,
        {
          input: "(".repeat(depth) + "x" + ")".repeat(depth),
          inputKind: InputNormalizationMode.Iterable,
          entryRuleName: "P",
        },
      );
      assertEquals(m.kind, MatchKind.Ok);
    },
  );
});
