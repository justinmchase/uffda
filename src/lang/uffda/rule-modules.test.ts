import { assertEquals } from "@std/assert";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { UffdaLang } from "./uffda.lang.ts";
import { SharedRules } from "./shared.rules.ts";
import { ImportRules } from "./import.rules.ts";
import { ExportRules } from "./export.rules.ts";
import { RuleDeclarationRules } from "./rule.rules.ts";

Deno.test("lang.uffda.rule-modules compose into UffdaLang", () => {
  const imports = UffdaLang.imports.filter((i) =>
    i.kind === ImportDeclarationKind.Module
  );

  const importModuleUrls = new Set(imports.map((i) => i.moduleUrl));
  assertEquals(importModuleUrls.has("./shared.rules.ts"), true);
  assertEquals(importModuleUrls.has("./import.rules.ts"), true);
  assertEquals(importModuleUrls.has("./export.rules.ts"), true);
  assertEquals(importModuleUrls.has("./rule.rules.ts"), true);

  const importedNames = new Set(imports.flatMap((i) => i.names));
  for (
    const module of [
      SharedRules,
      ImportRules,
      ExportRules,
      RuleDeclarationRules,
    ]
  ) {
    for (const exportDecl of module.exports) {
      assertEquals(importedNames.has(exportDecl.name), true);
    }
  }
});
