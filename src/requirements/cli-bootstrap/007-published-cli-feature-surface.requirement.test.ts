import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-007 - compile:lang uses a quoted lang .uff glob",
  async () => {
    const denoJson = await Deno.readTextFile(join(repoRoot, "deno.jsonc"));
    const checks = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );

    assertEquals(denoJson.includes("src/lang/**/*.uff"), true);
    assertEquals(checks.includes("src/lang/**/*.uff"), true);
  },
);
