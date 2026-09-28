import { assertEquals } from "@std/assert";
import { MatchKind, ok } from "../../match.ts";
import { Scope } from "../../runtime/scope.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  itemSpansFromTokenizerMatch,
  StructuredTokenKind,
  type TokenValue,
} from "./structured.ts";

function tok(kind: StructuredTokenKind, text: string): TokenValue {
  return { kind, text };
}

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

Deno.test("lang.tokenizer.structured itemSpansFromTokenizerMatch walks arbitrarily deep matches in order", () => {
  const scope = Scope.Default();
  const pattern = { kind: PatternKind.Any } as const;
  const spanned = (text: string, at: number) => {
    const m = ok(scope, scope, pattern, tok(StructuredTokenKind.Word, text));
    const span = { start: at, end: at + 1 };
    (m as { normalizedSpan: typeof span }).normalizedSpan = span;
    (m as { originalSpan: typeof span }).originalSpan = { ...span };
    return m;
  };

  // Nesting far deeper than the host call stack could recurse through, with
  // tokens before, inside, and after the deep branch.
  let deep = ok(scope, scope, pattern, undefined, [spanned("b", 1)]);
  for (let i = 0; i < 100_000; i++) {
    deep = ok(scope, scope, pattern, undefined, [deep]);
  }
  const root = ok(scope, scope, pattern, ["a", "b", "c"], [
    spanned("a", 0),
    deep,
    spanned("c", 2),
  ]);

  assertEquals(
    itemSpansFromTokenizerMatch(root).map((s) => s.normalized.start),
    [0, 1, 2],
  );
});
