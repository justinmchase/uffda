import { assertEquals } from "@std/assert";
import { builtInLanguageDeclarations } from "./declarations.ts";

Deno.test("lang.declarations registers built-in language modules", () => {
  const digitUrl = new URL("./common/characters/digit.ts", import.meta.url)
    .href;
  const patternLangUrl = new URL("./pattern/pattern.lang.ts", import.meta.url)
    .href;
  assertEquals(builtInLanguageDeclarations[digitUrl]?.rules[0]?.name, "Digit");
  assertEquals(
    builtInLanguageDeclarations[patternLangUrl]?.exports.some((item) =>
      item.name === "PatternLang"
    ),
    true,
  );
});
