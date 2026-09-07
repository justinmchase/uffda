import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-007 - compile:lang and Checks use installed uffda with glob",
  async () => {
    const denoJson = await Deno.readTextFile(join(repoRoot, "deno.jsonc"));
    const checks = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );

    assertEquals(denoJson.includes("uffda compile"), true);
    assertEquals(denoJson.includes("src/lang/**/*.uff"), true);
    assertEquals(denoJson.includes("deno task cli compile"), false);
    assertEquals(checks.includes("uffda compile"), true);
    assertEquals(checks.includes("src/lang/**/*.uff"), true);
    assertEquals(checks.includes("deno task cli compile"), false);

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
