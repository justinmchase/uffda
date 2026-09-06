import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:tokenizer-runtime-009 - EscapeTokens uses single-char EscapeFollower",
  async () => {
    const source = await Deno.readTextFile(
      join(repoRoot, "src/lang/tokenizer/mod.ts"),
    );
    assertEquals(source.includes('name: "EscapeFollower"'), true);
    assertEquals(source.includes('name: "EscapeTokens"'), true);
    assertEquals(source.includes("text: escaped"), true);
    assertEquals(source.includes('name: "WordToken"'), true);
    // EscapeTokens must not greedily reuse WordToken as the follower.
    const escapeTokensBlock = source.slice(
      source.indexOf('name: "EscapeTokens"'),
      source.indexOf('name: "StringPunctuationToken"'),
    );
    assertEquals(escapeTokensBlock.includes('name: "EscapeFollower"'), true);
    assertEquals(escapeTokensBlock.includes('name: "WordToken"'), false);
  },
);
