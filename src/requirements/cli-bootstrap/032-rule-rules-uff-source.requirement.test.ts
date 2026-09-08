import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-032 - rule.rules .uff source is converted",
  async () => {
    const ruleRules = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "rule.rules.uff"),
    );
    assertEquals(ruleRules.includes("export RuleDeclarationSyntax"), true);
    assertEquals(ruleRules.includes("export RulePatternBody"), true);
    assertEquals(ruleRules.includes("export RuleProjectionExpression"), true);
    assertEquals(ruleRules.includes("|> PatternTokens"), true);
    assertEquals(ruleRules.includes("|> ExpressionTokens"), true);
    assertEquals(ruleRules.includes("(flat (pack"), true);
    assertEquals(ruleRules.includes("(flat (coalesce"), true);
    assertEquals(ruleRules.includes("(coalesce j undefined)"), true);
    assertEquals(ruleRules.includes("ExpressionKind.Native"), false);
    assertEquals(ruleRules.includes("flat(Infinity)"), false);

    const uffdaLang = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "uffda.lang.ts"),
    );
    assertEquals(
      uffdaLang.includes('moduleUrl: "./rule.rules.uff"'),
      true,
    );
    assertEquals(
      uffdaLang.includes('moduleUrl: "./rule.rules.ts"'),
      false,
    );

    const exportRules = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "export.rules.uff"),
    );
    assertEquals(
      exportRules.includes('import "./rule.rules.uff" RuleDeclarationSyntax'),
      true,
    );
  },
);
