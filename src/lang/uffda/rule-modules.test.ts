import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const uffdaDir = join(repoRoot, "src", "lang", "uffda");

Deno.test("lang.uffda.rule-modules compose into UffdaLang", async () => {
  const uffdaLang = await Deno.readTextFile(join(uffdaDir, "uffda.lang.uff"));
  assertEquals(
    uffdaLang.includes('import "./import.rules.uff" ImportDeclarationSyntax'),
    true,
  );
  assertEquals(
    uffdaLang.includes('import "./export.rules.uff" ExportDeclarationSyntax'),
    true,
  );
  assertEquals(
    uffdaLang.includes('import "./rule.rules.uff" RuleDeclarationSyntax'),
    true,
  );
  assertEquals(uffdaLang.includes("rule ModuleBody"), true);

  const shared = await Deno.readTextFile(join(uffdaDir, "shared.rules.uff"));
  assertEquals(shared.includes("export IdentifierToken"), true);
  assertEquals(shared.includes("IdToken"), true);
  assertEquals(shared.includes("string & [Identifier]"), false);
  assertEquals(shared.includes("export ReservedKeywordToken"), true);

  const importRules = await Deno.readTextFile(
    join(uffdaDir, "import.rules.uff"),
  );
  assertEquals(importRules.includes("export ImportDeclarationSyntax"), true);
  assertEquals(importRules.includes("export ImportNameList"), true);
  assertEquals(importRules.includes("export ImportModuleSpecifier"), true);

  const exportRules = await Deno.readTextFile(
    join(uffdaDir, "export.rules.uff"),
  );
  assertEquals(exportRules.includes("export ExportDeclarationSyntax"), true);
  assertEquals(exportRules.includes("export ExportNameList"), true);
});
