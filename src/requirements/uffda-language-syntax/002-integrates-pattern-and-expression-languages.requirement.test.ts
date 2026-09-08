import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:uffda-language-syntax-002 - Uffda syntax integrates PatternLang and ExpressionLang for rule bodies",
  async () => {
    const ruleRules = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "rule.rules.uff"),
    );

    assertEquals(
      ruleRules.includes('import "../pattern/pattern.lang.uff" PatternTokens'),
      true,
    );
    assertEquals(
      ruleRules.includes(
        'import "../expression/expression.lang.uff" ExpressionTokens',
      ),
      true,
    );
    assertEquals(ruleRules.includes("|> PatternTokens"), true);
    assertEquals(ruleRules.includes("|> ExpressionTokens"), true);
    assertEquals(ruleRules.includes("ExpressionKind.Native"), false);
  },
);
