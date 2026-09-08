import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-distribution-005 - deno.jsonc excludes agent and requirement trees from JSR",
  async () => {
    const denoJson = await Deno.readTextFile(join(repoRoot, "deno.jsonc"));
    assertEquals(denoJson.includes('"publish"'), true);
    assertEquals(denoJson.includes(".agents/"), true);
    assertEquals(denoJson.includes(".cursor/"), true);
    assertEquals(denoJson.includes(".github/"), true);
    assertEquals(denoJson.includes("src/requirements/"), true);
  },
);
