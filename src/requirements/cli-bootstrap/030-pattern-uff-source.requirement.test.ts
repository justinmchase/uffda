import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const pattern = join(repoRoot, "src", "lang", "pattern");

Deno.test(
  "req:cli-bootstrap-030 - pattern .uff source is converted",
  async () => {
    const patternSrc = await Deno.readTextFile(join(pattern, "pattern.uff"));
    assertEquals(patternSrc.includes("export Pattern"), true);
    assertEquals(patternSrc.includes('import "./or.uff" Or'), true);
    assertEquals(patternSrc.includes("rule Pattern = Or"), true);

    for (
      const file of [
        "structure.uff",
        "resolve.uff",
      ]
    ) {
      const source = await Deno.readTextFile(join(pattern, file));
      assertEquals(source.includes('import "./pattern.uff" Pattern'), true);
      assertEquals(source.includes("pattern.ts"), false);
    }

    const prefixSrc = await Deno.readTextFile(join(pattern, "prefix.uff"));
    assertEquals(prefixSrc.includes('import "./pattern.uff" Pattern'), true);

    const patternLang = await Deno.readTextFile(
      join(pattern, "pattern.lang.uff"),
    );
    assertEquals(patternLang.includes('import "./pattern.uff" Pattern'), true);
  },
);
