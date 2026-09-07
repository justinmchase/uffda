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
  const patternLangUrl = new URL("./pattern/pattern.lang.ts", import.meta.url)
    .href;
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
  assertEquals(
    builtInLanguageDeclarations[patternLangUrl]?.exports.some((item) =>
      item.name === "PatternLang"
    ),
    true,
  );
});
