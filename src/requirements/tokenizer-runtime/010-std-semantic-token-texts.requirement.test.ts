import { assertEquals } from "@std/assert";
import { collect } from "../../testing.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { match } from "../../runtime/match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import type { TokenizerLangValue } from "../../lang/tokenizer/tokenizer.lang.ts";

// "a #x\n+" tokenizes to word "a", whitespace " ", comment "#x", newline
// "\n", punctuation "+".
const source = "a #x\n+";

Deno.test(
  "req:tokenizer-runtime-010 - semantic_texts omits comments but keeps whitespace",
  async () => {
    const resolver = new Resolver();
    const input = Input.Scalar(source);
    const moduleUrl = new URL(
      "../../lang/tokenizer/tokenizer.lang.uff",
      import.meta.url,
    );

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
    if (imported.kind !== ModuleImportResultKind.Module) {
      throw new Error("Failed to import tokenizer.lang.uff");
    }

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
          { kind: PatternKind.End },
        ],
      },
      scope,
    );
    if (m.kind !== MatchKind.Ok) {
      throw new Error(`Match was ${m.kind}`);
    }

    const [value] = m.value as [TokenizerLangValue, unknown];
    assertEquals(await collect(value.tokens), ["a", " ", "\n", "+"]);
  },
);

Deno.test(
  "req:tokenizer-runtime-010 - semantic_no_whitespace_texts omits comments and whitespace",
  moduleDeclarationTest({
    moduleUrl: new URL("../../lang/tokenizer/mod.uff", import.meta.url).href,
    entryRuleName: "TokenizerNoWhitespace",
    input: Input.Iterable(source),
    kind: MatchKind.Ok,
    value: ["a", "+"],
  }),
);
