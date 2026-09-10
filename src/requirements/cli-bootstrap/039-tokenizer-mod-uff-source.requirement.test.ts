import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const modUff = join(repoRoot, "src", "lang", "tokenizer", "mod.uff");

Deno.test(
  "req:cli-bootstrap-039 - tokenizer mod.uff exports Tokenizer and uses semantic_no_whitespace_texts",
  async () => {
    const source = await Deno.readTextFile(modUff);
    assertEquals(source.includes("export rule Tokenizer"), true);
    assertEquals(source.includes("export TokenizerNoWhitespace"), true);
    assertEquals(source.includes("export Token"), true);
    assertEquals(
      source.includes("(semantic_no_whitespace_texts _)"),
      true,
    );
    assertEquals(source.includes("rule EscapeFollower"), true);
    assertEquals(source.includes("rule SlashPunctuationToken"), true);
    assertEquals(source.includes("rule EscapeTokens"), true);
  },
);
