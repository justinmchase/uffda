import { assertEquals, assertNotEquals } from "@std/assert";
import { MatchKind, valueOf } from "../../match.ts";
import { expressionGrammar } from "../../lang/expression/expression.lang.ts";
import { defaultGlobals } from "../../runtime/globals/mod.ts";
import { exec } from "../../runtime/exec.ts";
import { unwrap } from "../../wrapped.ts";

Deno.test("req:expression-language-syntax-012 - Explicit coalescing syntax supports deterministic fallback behavior without infix precedence", async (t) => {
  await t.step(
    "explicit coalesce invocation returns first non-nullish value",
    async () => {
      const globals = new Map<string, unknown>([
        ...defaultGlobals,
        ["left", null],
        ["fallback", "ok"],
      ]);

      const m = await expressionGrammar("(coalesce left fallback)", {
        globals,
      });
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind === MatchKind.Ok) {
        const value = await exec(valueOf(m), m);
        assertEquals(unwrap(value), "ok");
      }
    },
  );

  await t.step("coalesce remains deterministic for fixed input", async () => {
    const globals = new Map<string, unknown>([
      ...defaultGlobals,
      ["left", undefined],
      ["fallback", 11],
    ]);

    const one = await expressionGrammar("(coalesce left fallback)", {
      globals,
    });
    const two = await expressionGrammar("(coalesce left fallback)", {
      globals,
    });

    assertEquals(one.kind, MatchKind.Ok);
    assertEquals(two.kind, MatchKind.Ok);

    if (one.kind === MatchKind.Ok && two.kind === MatchKind.Ok) {
      const oneValue = await exec(valueOf(one), one);
      const twoValue = await exec(valueOf(two), two);
      assertEquals(unwrap(oneValue), unwrap(twoValue));
      assertEquals(unwrap(oneValue), 11);
    }
  });

  await t.step(
    "infix null-coalescing syntax is deferred from MVP",
    async () => {
      const m = await expressionGrammar("(coalesce left ?? fallback)", {
        globals: new Map<string, unknown>([
          ...defaultGlobals,
          ["left", null],
          ["fallback", "ok"],
        ]),
      });

      assertNotEquals(m.kind, MatchKind.Ok);
    },
  );
});
