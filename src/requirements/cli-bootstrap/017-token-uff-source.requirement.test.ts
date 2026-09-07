import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const tokenUff = join(repoRoot, "src", "lang", "tokenizer", "token.uff");

Deno.test(
  "req:cli-bootstrap-017 - token.uff exports parametric Token via Surround",
  async () => {
    const source = await Deno.readTextFile(tokenUff);
    assertEquals(source.includes("export Token"), true);
    assertEquals(source.includes("rule W = string & [Whitespace*]"), true);
    assertEquals(source.includes("rule Token<P> = Surround<W, P, W>"), true);
  },
);
