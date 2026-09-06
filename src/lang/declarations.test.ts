import { assertEquals } from "@std/assert";
import { builtInLanguageDeclarations } from "./declarations.ts";

Deno.test("lang.declarations registers built-in language modules", () => {
  const digitUff = new URL("./common/characters/digit.uff", import.meta.url)
    .href;
  const combiningUff = new URL(
    "./common/characters/combining.uff",
    import.meta.url,
  ).href;
  const patternLangUrl = new URL("./pattern/pattern.lang.ts", import.meta.url)
    .href;
  assertEquals(builtInLanguageDeclarations[digitUff]?.rules[0]?.name, "Digit");
  assertEquals(
    builtInLanguageDeclarations[combiningUff]?.rules[0]?.name,
    "Combining",
  );
  assertEquals(
    builtInLanguageDeclarations[patternLangUrl]?.exports.some((item) =>
      item.name === "PatternLang"
    ),
    true,
  );
});
