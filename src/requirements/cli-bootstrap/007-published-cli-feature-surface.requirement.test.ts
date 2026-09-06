import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-007 - compile:lang and Checks use installed uffda only",
  async () => {
    const denoJson = await Deno.readTextFile(join(repoRoot, "deno.jsonc"));
    const checks = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );

    assertEquals(denoJson.includes("uffda compile"), true);
    assertEquals(denoJson.includes("src/cli/main.ts compile"), false);
    assertEquals(checks.includes("uffda compile"), true);
    assertEquals(checks.includes("src/cli/main.ts compile"), false);
  },
);
