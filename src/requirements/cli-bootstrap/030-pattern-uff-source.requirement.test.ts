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
        "prefix.ts",
        "structure.ts",
        "resolve.ts",
        "pattern.lang.ts",
      ]
    ) {
      const source = await Deno.readTextFile(join(pattern, file));
      assertEquals(source.includes('moduleUrl: "./pattern.uff"'), true);
      assertEquals(source.includes('moduleUrl: "./pattern.ts"'), false);
    }
  },
);
