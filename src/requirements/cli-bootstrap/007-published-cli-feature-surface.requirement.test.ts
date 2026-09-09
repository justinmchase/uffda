import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-007 - compile:lang uses the previous published uffda CLI directly",
  async () => {
    const denoJson = await Deno.readTextFile(join(repoRoot, "deno.jsonc"));
    const checks = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );

    assertEquals(denoJson.includes("compile_lang.ts"), false);
    assertEquals(denoJson.includes("finalize-bin-modules"), false);
    assertEquals(/uffda compile ['"]src\/lang/.test(denoJson), true);
    assertEquals(checks.includes("deno task compile:lang"), true);
    assertEquals(checks.includes("finalize-bin-modules"), false);

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
