import { assertEquals } from "@std/assert";
import { builtInLanguageDeclarations } from "./declarations.ts";

Deno.test("lang.declarations registers built-in language modules", () => {
  const letterUrl = new URL("./common/characters/letter.ts", import.meta.url)
    .href;
  const patternLangUrl = new URL("./pattern/pattern.lang.ts", import.meta.url)
    .href;
  assertEquals(
    builtInLanguageDeclarations[letterUrl]?.rules[0]?.name,
    "Letter",
  );
  assertEquals(
    builtInLanguageDeclarations[patternLangUrl]?.exports.some((item) =>
      item.name === "PatternLang"
    ),
    true,
  );
  assertEquals(
    builtInLanguageDeclarations[
      new URL("./common/characters/digit.uff", import.meta.url).href
    ],
    undefined,
  );
  assertEquals(
    builtInLanguageDeclarations[
      new URL("./common/characters/connecting.uff", import.meta.url).href
    ],
    undefined,
  );
  assertEquals(
    builtInLanguageDeclarations[
      new URL("./common/characters/formatting.uff", import.meta.url).href
    ],
    undefined,
  );
});
