import { assert, assertEquals } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import { compileModuleGraph } from "./module_graph.ts";

async function withFiles(
  files: Record<string, string>,
  body: (root: string) => Promise<void>,
): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "uffda-module-graph-" });
  try {
    for (const [path, text] of Object.entries(files)) {
      const full = join(root, path);
      await Deno.mkdir(join(full, ".."), { recursive: true });
      await Deno.writeTextFile(full, text);
    }
    await body(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

Deno.test("cli.module_graph compileModuleGraph", async (t) => {
  await t.step("compiles a module and its relative imports", async () => {
    await withFiles({
      "main.uff":
        'import "./lib/word.uff" Word;\nexport Main;\nrule Main = Word;',
      "lib/word.uff": "export Word;\nrule Word = string+;",
    }, async (root) => {
      const main = toFileUrl(join(root, "main.uff"));
      const result = await compileModuleGraph(main);
      assert(result.ok);
      assertEquals(
        Object.keys(result.declarations).sort(),
        [
          toFileUrl(join(root, "lib", "word.uff")).href,
          main.href,
        ].sort(),
      );
    });
  });

  await t.step("reports the module that fails to compile", async () => {
    await withFiles({
      "main.uff": 'import "./bad.uff" B;\nrule Main = B;',
      "bad.uff": "rule = ;",
    }, async (root) => {
      const result = await compileModuleGraph(
        toFileUrl(join(root, "main.uff")),
      );
      assert(!result.ok);
      assertEquals(result.moduleUrl, toFileUrl(join(root, "bad.uff")).href);
    });
  });

  await t.step("reports a missing module", async () => {
    await withFiles({}, async (root) => {
      const result = await compileModuleGraph(
        toFileUrl(join(root, "missing.uff")),
      );
      assert(!result.ok);
    });
  });

  await t.step("reports an import from a package", async () => {
    await withFiles({
      "main.uff": 'import "@acme/kv" K;\nrule Main = K;',
    }, async (root) => {
      const result = await compileModuleGraph(
        toFileUrl(join(root, "main.uff")),
      );
      assert(!result.ok);
      assert(result.message.includes("not supported yet"));
    });
  });
});

Deno.test("cli.module_graph explains a module that parses only by recovering", async () => {
  const root = await Deno.makeTempDir({ prefix: "uffda-module-graph-" });
  try {
    await Deno.writeTextFile(
      join(root, "main.uff"),
      "rule A = (a;\nrule B = b;",
    );
    const result = await compileModuleGraph(toFileUrl(join(root, "main.uff")));
    assert(!result.ok);
    assert(result.message.includes("Expected `)`"), result.message);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
