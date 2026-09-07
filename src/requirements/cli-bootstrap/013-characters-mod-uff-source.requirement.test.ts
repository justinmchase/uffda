import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const modUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "characters",
  "mod.uff",
);

Deno.test(
  "req:cli-bootstrap-013 - characters mod.uff re-exports leaf modules",
  async () => {
    const source = await Deno.readTextFile(modUff);
    for (
      const name of [
        "Combining",
        "Connecting",
        "Digit",
        "Formatting",
        "Letter",
        "NewLine",
        "Whitespace",
      ]
    ) {
      assertEquals(source.includes(name), true);
    }
    assertEquals(source.includes("import "), true);
    assertEquals(source.includes("export "), true);
  },
);
