import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test("req:uffda-language-syntax-003 - Uffda syntax carves out import export and rule declaration forms", async () => {
  const uffdaLang = await Deno.readTextFile(
    join(repoRoot, "src", "lang", "uffda", "uffda.lang.uff"),
  );
  assertEquals(uffdaLang.includes("ImportDeclarationSyntax"), true);
  assertEquals(uffdaLang.includes("ExportDeclarationSyntax"), true);
  assertEquals(uffdaLang.includes("RuleDeclarationSyntax"), true);
  assertEquals(uffdaLang.includes("rule ModuleBody"), true);

  const ruleRules = await Deno.readTextFile(
    join(repoRoot, "src", "lang", "uffda", "rule.rules.uff"),
  );
  assertEquals(ruleRules.includes("export RuleProjectionTail"), true);
});
