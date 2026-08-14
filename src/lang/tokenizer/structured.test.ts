import { assertEquals } from "@std/assert";
import {
  foldLineComments,
  StructuredTokenKind,
  type TokenValue,
  toSemanticTexts,
} from "./structured.ts";

function tok(kind: StructuredTokenKind, text: string): TokenValue {
  return { kind, text };
}

Deno.test("lang.tokenizer.structured foldLineComments preserves quoted hashes", () => {
  const folded = foldLineComments([
    tok(StructuredTokenKind.Punctuation, '"'),
    tok(StructuredTokenKind.Punctuation, "#"),
    tok(StructuredTokenKind.Punctuation, '"'),
    tok(StructuredTokenKind.Whitespace, " "),
    tok(StructuredTokenKind.Punctuation, "#"),
    tok(StructuredTokenKind.Word, "x"),
    tok(StructuredTokenKind.NewLine, "\n"),
  ]);

  assertEquals(folded.map((token) => [token.kind, token.text]), [
    [StructuredTokenKind.Punctuation, '"'],
    [StructuredTokenKind.Punctuation, "#"],
    [StructuredTokenKind.Punctuation, '"'],
    [StructuredTokenKind.Whitespace, " "],
    [StructuredTokenKind.Comment, "#x"],
    [StructuredTokenKind.NewLine, "\n"],
  ]);
});

Deno.test("lang.tokenizer.structured semantic texts omit comments", () => {
  const folded = foldLineComments([
    tok(StructuredTokenKind.Word, "any"),
    tok(StructuredTokenKind.Whitespace, " "),
    tok(StructuredTokenKind.Punctuation, "#"),
    tok(StructuredTokenKind.Word, "no"),
    tok(StructuredTokenKind.NewLine, "\n"),
  ]);

  assertEquals(toSemanticTexts(folded), ["any", " ", "\n"]);
  assertEquals(folded.map((token) => token.kind), [
    StructuredTokenKind.Word,
    StructuredTokenKind.Whitespace,
    StructuredTokenKind.Comment,
    StructuredTokenKind.NewLine,
  ]);
});
