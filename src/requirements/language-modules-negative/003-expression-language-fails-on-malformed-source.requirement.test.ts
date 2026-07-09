import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";

Deno.test(
  "req:language-modules-negative-003 - Expression language fails deterministically on malformed source",
  async (t) => {
    await t.step("incomplete expression source fails", async () => {
      const m = await expressionGrammar("(add 1");
      assertEquals(m.kind, MatchKind.Fail);
    });

    await t.step("trailing tokens after valid expression fail", async () => {
      const m = await expressionGrammar("(add 1 2) trailing");
      assertEquals(m.kind, MatchKind.Fail);
    });
  },
);
