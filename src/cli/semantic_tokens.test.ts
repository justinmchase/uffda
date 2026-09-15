import { assert, assertEquals } from "@std/assert";
import { HighlightRole, type HighlightSpan } from "./highlight.ts";
import {
  buildSemanticTokens,
  SEMANTIC_TOKENS_LEGEND,
} from "./semantic_tokens.ts";

/**
 * Coverage for projecting `HighlightSpan`s into LSP semantic-token data
 * (see `.agents/requirements/cli-language-server/005-syntax-highlighting.requirement.md`).
 */

function legendIndex(tokenType: string): number {
  const index = SEMANTIC_TOKENS_LEGEND.tokenTypes.indexOf(tokenType);
  assert(index >= 0, `missing legend entry for ${tokenType}`);
  return index;
}

Deno.test("cli.semantic_tokens buildSemanticTokens", async (t) => {
  await t.step("encodes a single-line span as one delta-encoded token", () => {
    const source = "rule";
    const spans: HighlightSpan[] = [{
      role: HighlightRole.Keyword,
      offset: 0,
      length: 4,
      text: "rule",
    }];
    const tokens = buildSemanticTokens(spans, source);
    // [deltaLine, deltaStart, length, tokenType, tokenModifiers]
    assertEquals(tokens.data, [0, 0, 4, legendIndex("keyword"), 0]);
  });

  await t.step("skips whitespace/newline roles (no legend entry)", () => {
    const source = "a b\n";
    const spans: HighlightSpan[] = [
      {
        role: HighlightRole.Identifier,
        offset: 0,
        length: 1,
        text: "a",
      },
      {
        role: HighlightRole.Whitespace,
        offset: 1,
        length: 1,
        text: " ",
      },
      {
        role: HighlightRole.Identifier,
        offset: 2,
        length: 1,
        text: "b",
      },
      {
        role: HighlightRole.NewLine,
        offset: 3,
        length: 1,
        text: "\n",
      },
    ];
    const tokens = buildSemanticTokens(spans, source);
    assertEquals(tokens.data, [
      0,
      0,
      1,
      legendIndex("variable"),
      0,
      0,
      2,
      1,
      legendIndex("variable"),
      0,
    ]);
  });

  await t.step("delta-encodes tokens across a line break", () => {
    const source = "ab\ncd";
    const spans: HighlightSpan[] = [
      {
        role: HighlightRole.Identifier,
        offset: 0,
        length: 2,
        text: "ab",
      },
      {
        role: HighlightRole.NewLine,
        offset: 2,
        length: 1,
        text: "\n",
      },
      {
        role: HighlightRole.String,
        offset: 3,
        length: 2,
        text: "cd",
      },
    ];
    const tokens = buildSemanticTokens(spans, source);
    assertEquals(tokens.data, [
      0,
      0,
      2,
      legendIndex("variable"),
      0,
      1,
      0,
      2,
      legendIndex("string"),
      0,
    ]);
  });

  await t.step("legend lists each mapped token type once", () => {
    assertEquals(
      new Set(SEMANTIC_TOKENS_LEGEND.tokenTypes).size,
      SEMANTIC_TOKENS_LEGEND.tokenTypes.length,
    );
    assertEquals(SEMANTIC_TOKENS_LEGEND.tokenModifiers, []);
  });
});
