import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import { BUILTIN_UFF_LANGUAGE } from "./lsp.config.ts";
import { LspGrammarProvider } from "./lsp.grammars.ts";
import { RuntimeSession } from "./mcp.session.ts";

const GRAMMAR = "export Main;\nrule Main = string & [any*];\n";

async function workspace(files: Record<string, string>): Promise<string> {
  const root = await Deno.makeTempDir({ prefix: "uffda-lsp-grammars-" });
  for (const [name, text] of Object.entries(files)) {
    await Deno.writeTextFile(join(root, name), text);
  }
  return root;
}

const language = (modulePath?: string, entryRuleName = "Main") => ({
  id: "lang",
  extensions: ["lang"],
  modulePath,
  entryRuleName,
});

Deno.test("cli.lsp.grammars LspGrammarProvider", async (t) => {
  await t.step(
    "resolves the built-in Uffda language's bundled grammar",
    async () => {
      const grammars = new LspGrammarProvider(Deno.cwd());
      const result = await grammars.grammarFor(BUILTIN_UFF_LANGUAGE);
      assert(result.ok);
      assertEquals(result.grammar.entryRuleName, "UffdaLang");
      assert(result.grammar.module.rules.has("UffdaLang"));
    },
  );

  await t.step("compiles a workspace grammar from disk", async () => {
    const root = await workspace({ "lang.uff": GRAMMAR });
    const grammars = new LspGrammarProvider(root);
    assertEquals(
      grammars.moduleUrlFor(language("./lang.uff"))?.href,
      toFileUrl(join(root, "lang.uff")).href,
    );
    const result = await grammars.grammarFor(language("./lang.uff"));
    assert(result.ok);
    assert(result.grammar.module.rules.has("Main"));
    const again = await grammars.grammarFor(language("./lang.uff"));
    assert(again.ok);
    assertEquals(again.grammar.module, result.grammar.module);
  });

  await t.step("reloads a workspace grammar after invalidate", async () => {
    const root = await workspace({ "lang.uff": GRAMMAR });
    const grammars = new LspGrammarProvider(root);
    const first = await grammars.grammarFor(language("./lang.uff"));
    assert(first.ok);
    grammars.invalidate(toFileUrl(join(root, "lang.uff")).href);
    const second = await grammars.grammarFor(language("./lang.uff"));
    assert(second.ok);
    assert(first.grammar.module !== second.grammar.module);
  });

  await t.step("reports a language that declares no grammar", async () => {
    const grammars = new LspGrammarProvider(Deno.cwd());
    const result = await grammars.grammarFor(language(undefined));
    assert(!result.ok);
    assertStringIncludes(result.message, '"modulePath" and "entryRuleName"');
  });

  await t.step("reports a missing grammar file", async () => {
    const root = await workspace({});
    const grammars = new LspGrammarProvider(root);
    const result = await grammars.grammarFor(language("./missing.uff"));
    assert(!result.ok);
    assertStringIncludes(result.message, "./missing.uff");
    assertStringIncludes(result.message, "is unavailable");
  });

  await t.step("reports a grammar that does not compile", async () => {
    const root = await workspace({ "lang.uff": "rule Main = (;\n" });
    const grammars = new LspGrammarProvider(root);
    const result = await grammars.grammarFor(language("./lang.uff"));
    assert(!result.ok);
    assertStringIncludes(result.message, "is unavailable: 1:");
  });

  await t.step("reports a missing entry rule", async () => {
    const root = await workspace({ "lang.uff": GRAMMAR });
    const grammars = new LspGrammarProvider(root);
    const result = await grammars.grammarFor(
      language("./lang.uff", "Nope"),
    );
    assert(!result.ok);
    assertStringIncludes(result.message, 'has no rule named "Nope"');
  });

  await t.step("prefers the module of an open grammar document", async () => {
    const root = await workspace({ "lang.uff": GRAMMAR });
    const path = join(root, "lang.uff");
    const session = new RuntimeSession("open", { cwd: root });
    const loaded = await session.load(
      "export Main;\nrule Main = string & [any];\n",
      path,
    );
    assert(loaded.ok);
    const href = toFileUrl(path).href;
    const grammars = new LspGrammarProvider(
      root,
      (at) => at === href ? { module: session.getModule(href) } : undefined,
    );
    const result = await grammars.grammarFor(language("./lang.uff"));
    assert(result.ok);
    assertEquals(result.grammar.module, session.getModule(href));
  });

  await t.step(
    "reports an open grammar document that has never compiled",
    async () => {
      const root = await workspace({ "lang.uff": GRAMMAR });
      const grammars = new LspGrammarProvider(root, () => ({}));
      const result = await grammars.grammarFor(language("./lang.uff"));
      assert(!result.ok);
      assertStringIncludes(result.message, "open document does not compile");
    },
  );
});
