import { assertEquals } from "@std/assert";
import { UffdaLang } from "../../lang/uffda/uffda.lang.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";

Deno.test("req:uffda-language-syntax-003 - Uffda syntax carves out import export and rule declaration forms", () => {
  const ruleNames = UffdaLang.imports
    .filter((i) => i.kind === ImportDeclarationKind.Module)
    .flatMap((i) => i.names);

  assertEquals(ruleNames.includes("ImportDeclarationSyntax"), true);
  assertEquals(ruleNames.includes("ExportDeclarationSyntax"), true);
  assertEquals(ruleNames.includes("RuleDeclarationSyntax"), true);
  assertEquals(UffdaLang.rules.some((r) => r.name === "ModuleBody"), true);
  assertEquals(ruleNames.includes("RuleProjectionTail"), true);
});
