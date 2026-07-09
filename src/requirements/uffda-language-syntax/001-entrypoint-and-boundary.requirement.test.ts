import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { uffdaGrammar, UffdaLang } from "../../lang/uffda/uffda.lang.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";

Deno.test("req:uffda-language-syntax-001 - Uffda language entrypoint is declared and enforces full-input consumption", async () => {
  const rule = UffdaLang.rules.find((r) => r.name === "UffdaLang");
  if (!rule) {
    throw new Error("Expected UffdaLang rule to be declared");
  }

  assertEquals(rule.pattern.kind, PatternKind.Then);

  const empty = await uffdaGrammar("");
  assertEquals(empty.kind, MatchKind.Ok);

  const importDeclaration = await uffdaGrammar('import "./a.ts" A;');
  assertEquals(importDeclaration.kind, MatchKind.Ok);

  const trailing = await uffdaGrammar('import "./a.ts" A; trailing');
  assertEquals(trailing.kind, MatchKind.Fail);
});
