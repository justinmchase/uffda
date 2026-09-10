import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:tokenizer-runtime-009 - EscapeTokens uses single-char EscapeFollower",
  async () => {
    const source = await Deno.readTextFile(
      join(repoRoot, "src/lang/tokenizer/mod.uff"),
    );
    assertEquals(source.includes("rule EscapeFollower"), true);
    assertEquals(source.includes("rule EscapeTokens"), true);
    assertEquals(source.includes("rule SlashPunctuationToken"), true);
    assertEquals(source.includes("rule WordToken"), true);
    // EscapeTokens must not greedily reuse WordToken as the follower.
    const escapeTokensBlock = source.slice(
      source.indexOf("rule EscapeTokens"),
      source.indexOf("rule WhitespaceToken"),
    );
    assertEquals(escapeTokensBlock.includes("EscapeFollower"), false);
    assertEquals(escapeTokensBlock.includes("WordToken"), false);
    assertEquals(
      escapeTokensBlock.includes("EscapeCharPunctuationToken"),
      true,
    );
  },
);
