import { assertEquals } from "@std/assert";
import { collect } from "../../testing.ts";
import { Input } from "../../input.ts";
import { MatchKind, type MatchOk, valueOf } from "../../match.ts";
import { charOrigins, type Wrapped } from "../../wrapped.ts";
import type { TokenizerLangValue } from "../../lang/tokenizer/tokenizer.lang.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { match } from "../../runtime/match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";

const moduleUrl =
  new URL("../../lang/tokenizer/tokenizer.lang.uff", import.meta.url)
    .href;

/** The wrapped normalized text of the `TokenizerLang` value in `m`. */
function sourceText(m: MatchOk): Wrapped<string> {
  const [lang] = m.value.raw as Wrapped[];
  const { source } = lang.raw as Record<string, Wrapped>;
  return (source.raw as Record<string, Wrapped<string>>).text;
}

Deno.test("req:tokenizer-runtime-002 - Source-normalization and tokenizer pipeline preserves reconstructable provenance", async () => {
  const resolver = new Resolver();
  const input = Input.Scalar("a\r\nb\rc\n");

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

  const imported = await resolver.import(new URL(moduleUrl), {
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
  assertEquals(value.source.text, "a\nb\nc\n");

  const text = sourceText(m);
  const newlines = charOrigins(text).filter((_, i) => text.raw[i] === "\n");
  assertEquals(newlines, [
    { start: 1, end: 3 },
    { start: 4, end: 5 },
    { start: 6, end: 7 },
  ]);
  assertEquals(await collect(value.tokens), ["a", "\n", "b", "\n", "c", "\n"]);
});
