import { assertEquals } from "@std/assert";
import { builtInLanguageDeclarations } from "./declarations.ts";

Deno.test("lang.declarations registers built-in language modules", () => {
  const digitUff = new URL("./common/characters/digit.uff", import.meta.url)
    .href;
  const charactersUff = new URL("./common/characters/mod.uff", import.meta.url)
    .href;
  const identifierUff = new URL("./common/identifier.uff", import.meta.url)
    .href;
  const patternLangUrl = new URL("./pattern/pattern.lang.ts", import.meta.url)
    .href;
  // Converted .uff modules load from ./bin, not the host registry.
  assertEquals(builtInLanguageDeclarations[digitUff], undefined);
  assertEquals(builtInLanguageDeclarations[charactersUff], undefined);
  assertEquals(builtInLanguageDeclarations[identifierUff], undefined);
  assertEquals(
    builtInLanguageDeclarations[patternLangUrl]?.exports.some((item) =>
      item.name === "PatternLang"
    ),
    true,
  );
});
