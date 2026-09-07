import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const spreadUff = join(repoRoot, "src", "lang", "common", "spread.uff");

Deno.test(
  "req:cli-bootstrap-018 - spread.uff exports SpreadMarker via Token<Dot>",
  async () => {
    const source = await Deno.readTextFile(spreadUff);
    assertEquals(source.includes("export SpreadMarker"), true);
    assertEquals(source.includes('rule Dot = "."'), true);
    assertEquals(source.includes("Token<Dot>"), true);
  },
);
