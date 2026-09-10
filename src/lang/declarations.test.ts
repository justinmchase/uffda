import { assertEquals } from "@std/assert";
import { builtInLanguageDeclarations } from "./declarations.ts";

Deno.test("lang.declarations registers built-in language modules", () => {
  const digitUff = new URL("./common/characters/digit.uff", import.meta.url)
    .href;
  const charactersUff = new URL("./common/characters/mod.uff", import.meta.url)
    .href;
  const identifierUff = new URL("./common/identifier.uff", import.meta.url)
    .href;
  const surroundUff = new URL("./common/surround.uff", import.meta.url).href;
  // Converted .uff modules load from ./bin, not the host registry.
  assertEquals(builtInLanguageDeclarations[digitUff], undefined);
  assertEquals(builtInLanguageDeclarations[charactersUff], undefined);
  assertEquals(builtInLanguageDeclarations[identifierUff], undefined);
  assertEquals(builtInLanguageDeclarations[surroundUff], undefined);
  const tokenUff = new URL("./tokenizer/token.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[tokenUff], undefined);
  const spreadUff = new URL("./common/spread.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[spreadUff], undefined);
  const booleanUff = new URL("./expression/boolean.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[booleanUff], undefined);
  const nullishUff = new URL("./expression/nullish.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[nullishUff], undefined);
  const referenceUff = new URL("./expression/reference.uff", import.meta.url)
    .href;
  assertEquals(builtInLanguageDeclarations[referenceUff], undefined);
  const terminalUff = new URL("./expression/terminal.uff", import.meta.url)
    .href;
  assertEquals(builtInLanguageDeclarations[terminalUff], undefined);
  const notUff = new URL("./expression/not.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[notUff], undefined);
  const memberUff = new URL("./expression/member.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[memberUff], undefined);
  const stringUff = new URL("./expression/string.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[stringUff], undefined);
  const importRulesUff = new URL("./uffda/import.rules.uff", import.meta.url)
    .href;
  assertEquals(builtInLanguageDeclarations[importRulesUff], undefined);
  const exportRulesUff = new URL("./uffda/export.rules.uff", import.meta.url)
    .href;
  assertEquals(builtInLanguageDeclarations[exportRulesUff], undefined);
  const ruleRulesUff = new URL("./uffda/rule.rules.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[ruleRulesUff], undefined);
  const uffdaLangUff = new URL("./uffda/uffda.lang.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[uffdaLangUff], undefined);
  const runtimeCompilerUff = new URL(
    "./uffda/runtime.compiler.uff",
    import.meta.url,
  ).href;
  assertEquals(builtInLanguageDeclarations[runtimeCompilerUff], undefined);
  const sourceUff = new URL("./source/mod.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[sourceUff], undefined);
  const tokenizerModUff = new URL("./tokenizer/mod.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[tokenizerModUff], undefined);
  const tokenizerLangUff =
    new URL("./tokenizer/tokenizer.lang.uff", import.meta.url).href;
  assertEquals(builtInLanguageDeclarations[tokenizerLangUff], undefined);
  for (
    const name of [
      "then",
      "pipe",
      "and",
      "or",
      "pattern",
      "pattern.lang",
      "projection",
      "prefix",
      "resolve",
      "structure",
      "atomic",
      "literals",
      "character_class",
    ] as const
  ) {
    const uff = new URL(`./pattern/${name}.uff`, import.meta.url).href;
    assertEquals(builtInLanguageDeclarations[uff], undefined);
  }
});
