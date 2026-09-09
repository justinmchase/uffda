import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-007 - compile:lang uses previous CLI + lower pipeline",
  async () => {
    const denoJson = await Deno.readTextFile(join(repoRoot, "deno.jsonc"));
    const checks = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );
    const compileLang = await Deno.readTextFile(
      join(repoRoot, "src", "cli", "compile_lang.ts"),
    );

    assertEquals(denoJson.includes("compile_lang.ts"), true);
    assertEquals(denoJson.includes("finalize-bin-modules"), false);
    assertEquals(checks.includes("deno task compile:lang"), true);
    assertEquals(checks.includes("finalize-bin-modules"), false);
    assertEquals(compileLang.includes('compile", glob'), true);
    assertEquals(compileLang.includes("src/lang/**/*.uff"), true);
    assertEquals(compileLang.includes("lowerUffdaSyntaxModule"), true);
    assertEquals(compileLang.includes('new Deno.Command("uffda"'), true);

    const charactersDir = join(
      repoRoot,
      "src",
      "lang",
      "common",
      "characters",
    );
    let bootstrapTwins = 0;
    for await (const entry of Deno.readDir(charactersDir)) {
      if (entry.isFile && entry.name.endsWith(".bootstrap.ts")) {
        bootstrapTwins += 1;
      }
    }
    assertEquals(bootstrapTwins, 0);
  },
);
