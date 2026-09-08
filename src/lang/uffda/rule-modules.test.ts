import { assertEquals } from "@std/assert";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { UffdaLang } from "./uffda.lang.ts";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test("lang.uffda.rule-modules compose into UffdaLang", async () => {
  const imports = UffdaLang.imports.filter((i) =>
    i.kind === ImportDeclarationKind.Module
  );

  const importModuleUrls = new Set(imports.map((i) => i.moduleUrl));
  assertEquals(importModuleUrls.has("./shared.rules.uff"), true);
  assertEquals(importModuleUrls.has("./import.rules.uff"), true);
  assertEquals(importModuleUrls.has("./export.rules.uff"), true);
  assertEquals(importModuleUrls.has("./rule.rules.ts"), true);

  const importedNames = new Set(imports.flatMap((i) => i.names));
  const shared = await Deno.readTextFile(
    join(repoRoot, "src", "lang", "uffda", "shared.rules.uff"),
  );
  assertEquals(shared.includes("export IdentifierToken"), true);
  assertEquals(shared.includes("export ReservedKeywordToken"), true);
  assertEquals(importedNames.has("IdentifierToken"), true);
  assertEquals(importedNames.has("ReservedKeywordToken"), true);
  assertEquals(importedNames.has("ImportDeclarationSyntax"), true);
  const importRules = await Deno.readTextFile(
    join(repoRoot, "src", "lang", "uffda", "import.rules.uff"),
  );
  assertEquals(importRules.includes("export ImportDeclarationSyntax"), true);
  assertEquals(importRules.includes("export ImportNameList"), true);
  assertEquals(importRules.includes("export ImportModuleSpecifier"), true);
  assertEquals(importedNames.has("ExportDeclarationSyntax"), true);
  const exportRules = await Deno.readTextFile(
    join(repoRoot, "src", "lang", "uffda", "export.rules.uff"),
  );
  assertEquals(exportRules.includes("export ExportDeclarationSyntax"), true);
  assertEquals(exportRules.includes("export ExportNameList"), true);
});
