import { assertEquals, assertNotEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { std } from "../../runtime/std/mod.ts";
import { exec } from "../../runtime/exec.ts";

Deno.test("req:expression-language-syntax-012 - Explicit coalescing syntax supports deterministic fallback behavior without infix precedence", async (t) => {
  await t.step(
    "explicit coalesce invocation returns first non-nullish value",
    async () => {
      const globals = new Map<string, unknown>([
        ...std,
        ["left", null],
        ["fallback", "ok"],
      ]);

      const m = await expressionGrammar("(coalesce left fallback)", { globals });
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        const value = await exec(m.value, m);
        assertEquals(value, "ok");
      }
    },
  );

  await t.step("coalesce remains deterministic for fixed input", async () => {
    const globals = new Map<string, unknown>([
      ...std,
      ["left", undefined],
      ["fallback", 11],
    ]);

    const one = await expressionGrammar("(coalesce left fallback)", { globals });
    const two = await expressionGrammar("(coalesce left fallback)", { globals });

    assertEquals(one.kind, MatchKind.Ok);
    assertEquals(two.kind, MatchKind.Ok);

    if (one.kind === MatchKind.Ok && two.kind === MatchKind.Ok) {
      const oneValue = await exec(one.value, one);
      const twoValue = await exec(two.value, two);
      assertEquals(oneValue, twoValue);
      assertEquals(oneValue, 11);
    }
  });

  await t.step(
    "infix null-coalescing syntax is deferred from MVP",
    async () => {
      const m = await expressionGrammar("(coalesce left ?? fallback)", {
        globals: new Map<string, unknown>([
          ...std,
          ["left", null],
          ["fallback", "ok"],
        ]),
      });

      assertNotEquals(m.kind, MatchKind.Ok);
    },
  );
});
