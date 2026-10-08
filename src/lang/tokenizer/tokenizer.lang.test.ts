import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind, type MatchOk, valueOf } from "../../match.ts";
import { charOrigins, type Wrapped } from "../../wrapped.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { match } from "../../runtime/match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { collect } from "../../testing.ts";
import {
  isTokenValue,
  StructuredTokenKind,
  tokenizerGrammar,
  type TokenizerLangValue,
} from "./tokenizer.lang.ts";

/** The wrapped normalized text of the `TokenizerLang` value in `m`. */
function sourceText(m: MatchOk): Wrapped<string> {
  const [lang] = m.value.raw as Wrapped[];
  const { source } = lang.raw as Record<string, Wrapped>;
  return (source.raw as Record<string, Wrapped<string>>).text;
}

Deno.test("lang.tokenizer.tokenizer-lang - isTokenValue accepts kind and text only", () => {
  assertEquals(
    isTokenValue({ kind: StructuredTokenKind.Word, text: "a" }),
    true,
  );
  assertEquals(isTokenValue({ kind: "other", text: "a" }), false);
  assertEquals(isTokenValue({ kind: StructuredTokenKind.Word }), false);
  assertEquals(isTokenValue(null), false);
});

Deno.test("lang.tokenizer.tokenizer-lang - pipelines normalization and tokenization", async () => {
  const resolver = new Resolver();
  const input = Input.Scalar("a\r\nb\rc");
  const moduleUrl = new URL("./tokenizer.lang.uff", import.meta.url);

  const importScope = new Scope(
    undefined,
    undefined,
    new Map(),
    new Map(),
    input,
    undefined,
    undefined,
    { resolver },
  );

  const imported = await resolver.import(moduleUrl, {
    scope: importScope,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: "TokenizerLang",
    },
  });

  assertEquals(imported.kind, ModuleImportResultKind.Module);
  if (imported.kind !== ModuleImportResultKind.Module) return;

  const scope = new Scope(
    imported.module,
    undefined,
    new Map(),
    new Map(),
    input,
    undefined,
    undefined,
    { resolver },
  );

  const m = await match(
    {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
          name: "TokenizerLang",
        },
        {
          kind: PatternKind.End,
        },
      ],
    },
    scope,
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind !== MatchKind.Ok) return;

  const [value] = valueOf(m) as [TokenizerLangValue, unknown];
  assertEquals(value.source.text, "a\nb\nc");
  assertEquals(charOrigins(sourceText(m)), [
    { start: 0, end: 1 },
    { start: 1, end: 3 },
    { start: 3, end: 4 },
    { start: 4, end: 5 },
    { start: 5, end: 6 },
  ]);
  assertEquals(await collect(value.tokens), ["a", "\n", "b", "\n", "c"]);
});

Deno.test(
  "req:cli-distribution-007 - tokenizerGrammar returns normalized source and tokens",
  async () => {
    const parsed = await tokenizerGrammar("a\r\nb");
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const value = valueOf(parsed);
    assertEquals(value.source.text, "a\nb");
    assertEquals(await collect(value.tokens), ["a", "\n", "b"]);
  },
);
