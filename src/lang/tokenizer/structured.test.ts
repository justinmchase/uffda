import { assertEquals } from "@std/assert";
import { MatchKind, ok } from "../../match.ts";
import { Scope } from "../../runtime/scope.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  foldLineComments,
  itemSpansFromTokenizerMatch,
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

Deno.test("lang.tokenizer.structured itemSpansFromTokenizerMatch keeps semantic spans", () => {
  const scope = Scope.Default();
  const pattern = { kind: PatternKind.Any } as const;
  const word = ok(scope, scope, pattern, tok(StructuredTokenKind.Word, "a"));
  const space = ok(
    scope,
    scope,
    pattern,
    tok(StructuredTokenKind.Whitespace, " "),
  );
  const bang = ok(
    scope,
    scope,
    pattern,
    tok(StructuredTokenKind.Punctuation, "!"),
  );
  // Force distinct spans used by the extractor.
  (word as { normalizedSpan: { start: number; end: number } }).normalizedSpan =
    { start: 0, end: 1 };
  (word as { originalSpan: { start: number; end: number } }).originalSpan = {
    start: 10,
    end: 11,
  };
  (space as { normalizedSpan: { start: number; end: number } }).normalizedSpan =
    { start: 1, end: 2 };
  (space as { originalSpan: { start: number; end: number } }).originalSpan = {
    start: 11,
    end: 12,
  };
  (bang as { normalizedSpan: { start: number; end: number } }).normalizedSpan =
    {
      start: 2,
      end: 3,
    };
  (bang as { originalSpan: { start: number; end: number } }).originalSpan = {
    start: 12,
    end: 13,
  };

  const root = ok(scope, scope, pattern, ["a", "!"], [word, space, bang]);
  assertEquals(root.kind, MatchKind.Ok);
  assertEquals(itemSpansFromTokenizerMatch(root), [
    {
      normalized: { start: 0, end: 1 },
      original: { start: 10, end: 11 },
    },
    {
      normalized: { start: 2, end: 3 },
      original: { start: 12, end: 13 },
    },
  ]);
});
