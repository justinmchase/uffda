// Traces to
// `.agents/requirements/cli-distribution/007-jsr-public-grammar-apis.requirement.md`.

import { assert, assertEquals } from "@std/assert";
import { expandGlob } from "@std/fs";
import { parse as parseJsonc } from "@std/jsonc";
import { fromFileUrl, relative } from "@std/path";
import { isClean, MatchKind, valueOf } from "../../src/match.ts";
import { visualizeMatchFailure } from "../../src/match.visualize.ts";
import {
  type Expression as ExpressionGrammarAst,
  expressionGrammar,
  ExpressionKind as GrammarExpressionKind,
} from "../../src/lang/expression/expression.lang.ts";
import {
  type Pattern as PatternGrammarAst,
  patternGrammar,
  PatternKind as GrammarPatternKind,
} from "../../src/lang/pattern/pattern.lang.ts";
import { tokenizerGrammar } from "../../src/lang/tokenizer/tokenizer.lang.ts";
import { uffdaGrammar } from "../../src/lang/uffda/uffda.lang.ts";
import { executeCliModule } from "../../src/cli/exec.ts";
import { InputNormalizationMode } from "../../src/input.ts";
import { readLanguageMetadata } from "../../src/cli/language_metadata.ts";
import { fakeJsrPackages } from "../../src/packages/fake_registry.ts";
import { parseGrammar } from "../../src/lang/grammar.ts";
import { compileUffdaSource } from "../../src/lang/uffda/execute.ts";
import type { Pattern } from "../../src/runtime/patterns/pattern.ts";
import { unwrap } from "../../src/wrapped.ts";
import {
  ExpressionKind,
  InputNormalizationMode as RuntimeInputNormalizationMode,
  match as matchPattern,
  PatternKind,
  Scope,
} from "../../src/runtime/public.ts";
import type {
  Expression,
  Pattern as PublicPattern,
} from "../../src/runtime/public.ts";

const root = fromFileUrl(new URL("../../", import.meta.url));

/** The files the package publishes that loading its grammars reads. */
async function packageFiles(): Promise<Record<string, string>> {
  const files: Record<string, string> = {
    "uffda.jsonc": await Deno.readTextFile(`${root}uffda.jsonc`),
  };
  for await (const file of expandGlob("bin/**/*.json", { root })) {
    files[relative(root, file.path).replaceAll("\\", "/")] = await Deno
      .readTextFile(file.path);
  }
  return files;
}

Deno.test(
  "req:cli-distribution-007 - JSR exposes the reusable TypeScript grammar APIs",
  async () => {
    const config = parseJsonc(await Deno.readTextFile(`${root}deno.jsonc`)) as {
      exports: Record<string, string>;
    };
    const grammarExports = parseJsonc(
      await Deno.readTextFile(`${root}uffda.jsonc`),
    ) as { exports: Record<string, string> };
    assertEquals(config.exports["./grammar"], "./src/lang/grammar.ts");
    assertEquals(config.exports["./runtime"], "./src/runtime/public.ts");
    assertEquals(
      config.exports["./tokenizer"],
      "./src/lang/tokenizer/tokenizer.lang.ts",
    );
    assertEquals(
      config.exports["./pattern"],
      "./src/lang/pattern/pattern.lang.ts",
    );
    assertEquals(
      config.exports["./expression"],
      "./src/lang/expression/expression.lang.ts",
    );
    assertEquals(config.exports["./uffda"], "./src/lang/uffda/uffda.lang.ts");
    assertEquals(
      config.exports["./language-metadata"],
      "./src/cli/language_metadata.ts",
    );
    assertEquals(
      grammarExports.exports["./source"],
      "./src/lang/source/mod.uff",
    );

    const metadata = readLanguageMetadata({
      id: "foreign",
      extensions: [".FOREIGN"],
    });
    assert(metadata.ok);
    assertEquals(metadata.metadata.extensions, [".foreign"]);

    const pattern = await patternGrammar("any");
    assert(isClean(pattern));
    const expression = await expressionGrammar("42");
    assert(isClean(expression));
    const tokens = await tokenizerGrammar("one two");
    assert(isClean(tokens));

    const runtimePattern: PublicPattern = { kind: PatternKind.Any };
    const grammarPattern: PatternGrammarAst = runtimePattern;
    const runtimeExpression: Expression = {
      kind: ExpressionKind.Number,
      value: 42,
    };
    const grammarExpression: ExpressionGrammarAst = runtimeExpression;
    assertEquals([grammarPattern.kind, grammarExpression.value], [
      PatternKind.Any,
      42,
    ]);
    assertEquals([GrammarPatternKind.Any, GrammarExpressionKind.Number], [
      PatternKind.Any,
      ExpressionKind.Number,
    ]);
    const runtimeMatch = await matchPattern(
      runtimePattern,
      Scope.From(["token"], { kind: RuntimeInputNormalizationMode.Iterable }),
    );
    assert(isClean(runtimeMatch));
    assertEquals(valueOf(runtimeMatch), "token");
  },
);

Deno.test(
  "req:cli-distribution-007 - published grammar exports compose in a foreign grammar",
  async () => {
    const { packages } = await fakeJsrPackages({
      "@justinmchase/uffda": {
        "1.0.0": { files: await packageFiles() },
      },
    });
    const source = [
      'import "jsr:@justinmchase/uffda@^1/tokenizer" Tokenizer;',
      'import "jsr:@justinmchase/uffda@^1/tokenizer-lang" TokenizerLang;',
      'import "jsr:@justinmchase/uffda@^1/pattern" PatternLang;',
      'import "jsr:@justinmchase/uffda@^1/expression" ExpressionLang;',
      'import "jsr:@justinmchase/uffda@^1/imports" ImportDeclarationSyntax;',
      'import "jsr:@justinmchase/uffda@^1/exports" ExportDeclarationSyntax;',
      'import "jsr:@justinmchase/uffda@^1/language" Language;',
      "export rule Main = PatternLang;",
    ].join("\n");
    const parsed = await uffdaGrammar(source);
    assert(parsed.kind === MatchKind.Ok);
    assert(isClean(parsed), await visualizeMatchFailure(parsed));

    const result = await executeCliModule(valueOf(parsed), "Main", {
      packages,
      moduleUrl: new URL("file:///uffda-cli-distribution-007/main.uff"),
      input: "any",
      inputKind: InputNormalizationMode.Iterable,
    });
    assert(result.ok, JSON.stringify(!result.ok && result.error));
    assert(result.value !== undefined);

    const foreignModuleUrl = new URL(
      "file:///uffda-cli-distribution-007/foreign.uff",
    );
    const foreignDeclaration = await compileUffdaSource(
      'import "@justinmchase/uffda/pattern" PatternLang;\n' +
        "export rule Main = PatternLang;",
    );
    assert(isClean(foreignDeclaration));
    const lowered = await parseGrammar<Pattern>({
      source: "any",
      moduleUrl: foreignModuleUrl,
      entryRuleName: "Main",
      grammarOptions: {
        declarations: {
          [foreignModuleUrl.href]: valueOf(foreignDeclaration),
        },
        resolverOptions: {
          imports: new Map([
            ["@justinmchase/uffda", "jsr:@justinmchase/uffda@^1"],
          ]),
          packages,
        },
      },
    });
    assert(isClean(lowered), await visualizeMatchFailure(lowered));
    assertEquals(unwrap(lowered.value), { kind: "any" });
  },
);

Deno.test(
  "req:cli-distribution-007 - published raw pattern and expression rules compose over tokens",
  async () => {
    const { packages } = await fakeJsrPackages({
      "@justinmchase/uffda": {
        "1.0.0": { files: await packageFiles() },
      },
    });
    const cases = [
      {
        specifier: "pattern",
        name: "Pattern",
        input: ["any"],
        expected: { kind: "any" },
      },
      {
        specifier: "pattern-syntax",
        name: "Pattern",
        input: ["any"],
        expected: { kind: "any" },
      },
      {
        specifier: "expression",
        name: "Expression",
        input: ["42"],
        expected: { kind: "number", value: 42 },
      },
      {
        specifier: "expression-syntax",
        name: "Expression",
        input: ["42"],
        expected: { kind: "number", value: 42 },
      },
    ];
    for (const { specifier, name, input, expected } of cases) {
      const parsed = await uffdaGrammar(
        `import "jsr:@justinmchase/uffda@^1/${specifier}" ${name};\n` +
          `export rule Main = ${name};`,
      );
      assert(parsed.kind === MatchKind.Ok);
      assert(isClean(parsed), await visualizeMatchFailure(parsed));

      const result = await executeCliModule(valueOf(parsed), "Main", {
        packages,
        moduleUrl: new URL("file:///uffda-cli-distribution-007/raw.uff"),
        input,
        inputKind: InputNormalizationMode.Iterable,
      });
      assert(result.ok, JSON.stringify(!result.ok && result.error));
      assertEquals(result.value, expected);
    }

    const sourceGrammar = await uffdaGrammar(
      'import "jsr:@justinmchase/uffda@^1/source" Source;\n' +
        "export rule Main = Source;",
    );
    assert(sourceGrammar.kind === MatchKind.Ok);
    assert(isClean(sourceGrammar), await visualizeMatchFailure(sourceGrammar));
    const sourceResult = await executeCliModule(
      valueOf(sourceGrammar),
      "Main",
      {
        packages,
        moduleUrl: new URL("file:///uffda-cli-distribution-007/source.uff"),
        input: ["a", "b", "c"],
        inputKind: InputNormalizationMode.Iterable,
      },
    );
    assert(
      sourceResult.ok,
      JSON.stringify(!sourceResult.ok && sourceResult.error),
    );
    assert(sourceResult.value !== undefined);
  },
);
