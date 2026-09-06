import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const letterUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "characters",
  "letter.uff",
);

Deno.test(
  "req:cli-bootstrap-009 - letter.uff exports Letter",
  async () => {
    const source = await Deno.readTextFile(letterUff);
    assertEquals(source.includes("export rule Letter"), true);
    assertEquals(source.includes("\\cL"), true);
    assertEquals(source.includes("\\cNl"), true);
  },
);
