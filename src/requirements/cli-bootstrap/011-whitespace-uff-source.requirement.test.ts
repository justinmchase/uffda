import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const whitespaceUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "characters",
  "whitespace.uff",
);

Deno.test(
  "req:cli-bootstrap-011 - whitespace.uff exports Whitespace",
  async () => {
    const source = await Deno.readTextFile(whitespaceUff);
    assertEquals(source.includes("export rule Whitespace"), true);
    assertEquals(source.includes("\\cZs"), true);
    assertEquals(source.includes("\\cZl"), true);
    assertEquals(source.includes("\\cZp"), true);
    assertEquals(source.includes('"\\t"'), true);
  },
);
