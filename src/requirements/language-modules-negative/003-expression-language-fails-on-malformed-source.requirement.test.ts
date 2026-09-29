import { assertEquals } from "@std/assert";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { isClean } from "../../match.ts";

Deno.test(
  "req:language-modules-negative-003 - Expression language fails deterministically on malformed source",
  async (t) => {
    await t.step("incomplete expression source fails", async () => {
      const m = await expressionGrammar("(add 1");
      assertEquals(isClean(m), false);
    });

    await t.step("trailing tokens after valid expression fail", async () => {
      const m = await expressionGrammar("(add 1 2) trailing");
      assertEquals(isClean(m), false);
    });
  },
);
