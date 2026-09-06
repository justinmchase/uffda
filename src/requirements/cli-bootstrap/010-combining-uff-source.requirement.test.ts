import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const combiningUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "characters",
  "combining.uff",
);

Deno.test(
  "req:cli-bootstrap-010 - combining.uff exports Combining",
  async () => {
    const source = await Deno.readTextFile(combiningUff);
    assertEquals(source.includes("export rule Combining"), true);
    assertEquals(source.includes("\\cMn"), true);
    assertEquals(source.includes("\\cMe"), true);
    assertEquals(source.includes("\\cMc"), true);
  },
);
