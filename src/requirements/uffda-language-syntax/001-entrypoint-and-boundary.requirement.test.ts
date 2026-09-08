import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { fromFileUrl, join } from "@std/path";

Deno.test("req:uffda-language-syntax-001 - Uffda language entrypoint is declared and enforces full-input consumption", async () => {
  const uffdaLang = await Deno.readTextFile(
    join(
      fromFileUrl(new URL("../../../", import.meta.url)),
      "src",
      "lang",
      "uffda",
      "uffda.lang.uff",
    ),
  );
  assertEquals(uffdaLang.includes("export UffdaLang"), true);
  assertEquals(uffdaLang.includes("rule UffdaLang"), true);
  assertEquals(uffdaLang.includes("end"), true);
  assertEquals(uffdaLang.includes("Source"), true);
  assertEquals(uffdaLang.includes("TokenizerNoWhitespace"), true);
  assertEquals(uffdaLang.includes("[ModuleBody]"), true);

  const empty = await uffdaGrammar("");
  assertEquals(empty.kind, MatchKind.Ok);

  const importDeclaration = await uffdaGrammar('import "./a.ts" A;');
  assertEquals(importDeclaration.kind, MatchKind.Ok);

  const trailing = await uffdaGrammar('import "./a.ts" A; trailing');
  assertEquals(trailing.kind, MatchKind.Fail);
});
