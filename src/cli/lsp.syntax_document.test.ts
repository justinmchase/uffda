import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { isClean, valueOf } from "../match.ts";
import { LSP_GRAMMAR_UNAVAILABLE } from "./lsp.diagnostics.ts";
import {
  type LanguageGrammarResult,
  LspGrammarProvider,
} from "./lsp.grammars.ts";
import { parseWithGrammar, SyntaxDocument } from "./lsp.syntax_document.ts";
import { CliStreamFailureCode } from "./stream.ts";

const KV_GRAMMAR = `export Main;

decorator Highlight<c:any> = c;

[Highlight { role: "keyword" }]
rule Key = ("a".."z")+;

[Highlight { role: "string" }]
rule Value = (not "\\n" any)*;

rule Pair = k:Key "=" Value "\\n" -> (join k "");

rule Junk = (not "\\n" any)* "\\n";

rule Main = string & [(ope Pair sneak by skip Junk)*];
`;

async function kvGrammar(): Promise<LanguageGrammarResult> {
  const root = await Deno.makeTempDir({ prefix: "uffda-lsp-syntax-" });
  await Deno.writeTextFile(join(root, "kv.uff"), KV_GRAMMAR);
  return await new LspGrammarProvider(root).grammarFor({
    id: "kv",
    extensions: ["kv"],
    modulePath: "./kv.uff",
    entryRuleName: "Main",
  });
}

Deno.test("cli.lsp.syntax_document parseWithGrammar", async () => {
  const grammar = await kvGrammar();
  assert(grammar.ok);
  const match = await parseWithGrammar(grammar.grammar, "ab=1\ncd=2\n");
  assert(isClean(match));
  assertEquals(valueOf(match), ["ab", "cd"]);
});

Deno.test("cli.lsp.syntax_document SyntaxDocument", async (t) => {
  const grammar = await kvGrammar();
  assert(grammar.ok);

  await t.step("a clean parse has no diagnostics and highlights", async () => {
    const document = new SyntaxDocument("ab=1\n");
    assertEquals(await document.parse(grammar), []);
    assert(document.parsedWith(grammar));
    const { data } = document.semanticTokens();
    assert(data.length > 0);
    assertEquals(data.length % 5, 0);
  });

  await t.step("reports each recovery over the skipped source", async () => {
    const document = new SyntaxDocument("ab=1\n9x\ncd=2\n");
    const diagnostics = await document.parse(grammar);
    assertEquals(diagnostics.length, 1);
    assertEquals(diagnostics[0].code, CliStreamFailureCode.Recovered);
    assertEquals(diagnostics[0].range, {
      start: { line: 1, character: 0 },
      end: { line: 2, character: 0 },
    });
    assertEquals(document.diagnostics, diagnostics);
  });

  await t.step(
    "reports an unavailable grammar on the first line, without tokens",
    async () => {
      const document = new SyntaxDocument("ab=1\ncd=2\n");
      const unavailable = { ok: false, message: "no grammar" } as const;
      const diagnostics = await document.parse(unavailable);
      assertEquals(diagnostics.length, 1);
      assertEquals(diagnostics[0].code, LSP_GRAMMAR_UNAVAILABLE);
      assertEquals(diagnostics[0].message, "no grammar");
      assertEquals(diagnostics[0].range, {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 4 },
      });
      assertEquals(document.semanticTokens(), { data: [] });
      assertEquals(document.parsedWith(unavailable), false);
    },
  );

  await t.step(
    "an incremental change matches a full parse of the new text",
    async () => {
      const document = new SyntaxDocument("ab=1\n9x\ncd=2\n");
      await document.parse(grammar);
      const diagnostics = await document.change([{
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 2 },
        },
        text: "q=3",
      }], grammar);
      assertEquals(document.source, "ab=1\nq=3\ncd=2\n");
      assertEquals(diagnostics, []);

      const fresh = new SyntaxDocument(document.source);
      await fresh.parse(grammar);
      assertEquals(document.semanticTokens(), fresh.semanticTokens());
    },
  );

  await t.step("a full-text change replaces the document", async () => {
    const document = new SyntaxDocument("ab=1\n");
    await document.parse(grammar);
    const diagnostics = await document.change([{ text: "!\n" }], grammar);
    assertEquals(document.source, "!\n");
    assertEquals(diagnostics.length, 1);
  });

  await t.step(
    "a change after the grammar changed re-parses in full",
    async () => {
      const document = new SyntaxDocument("ab=1\n");
      await document.parse({ ok: false, message: "no grammar" });
      const diagnostics = await document.change([{
        range: {
          start: { line: 0, character: 4 },
          end: { line: 0, character: 4 },
        },
        text: "0",
      }], grammar);
      assertEquals(document.source, "ab=10\n");
      assertEquals(diagnostics, []);
      assert(document.parsedWith(grammar));
    },
  );
});
