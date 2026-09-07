import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const newLineUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "characters",
  "newLine.uff",
);

Deno.test(
  "req:cli-bootstrap-012 - newLine.uff exports NewLine with LF projection",
  async () => {
    const source = await Deno.readTextFile(newLineUff);
    assertEquals(source.includes("export rule NewLine"), true);
    assertEquals(source.includes('"\\r"'), true);
    assertEquals(source.includes('"\\n"'), true);
    assertEquals(source.includes('-> "\\n"'), true);
  },
);
