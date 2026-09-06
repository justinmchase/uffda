import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const formattingUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "characters",
  "formatting.uff",
);

Deno.test(
  "req:cli-bootstrap-008 - formatting.uff exports Formatting",
  async () => {
    const source = await Deno.readTextFile(formattingUff);
    assertEquals(source.includes("export rule Formatting"), true);
    assertEquals(source.includes("\\cCf"), true);
  },
);
