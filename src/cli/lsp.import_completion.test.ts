import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import {
  type CompletionContext,
  CompletionContextKind,
  completionContextsAt,
} from "./lsp.completion_context.ts";
import {
  nameCompletionItems,
  specifierCompletionItems,
} from "./lsp.import_completion.ts";
import { RuntimeSession } from "./mcp.session.ts";

async function contextAtEnd(source: string): Promise<CompletionContext> {
  const [context] = completionContextsAt(await uffdaGrammar(source), source);
  assert(context, `no completion context at the end of ${source}`);
  return context;
}

Deno.test("cli.lsp.import_completion items", async (t) => {
  const cwd = await Deno.makeTempDir({ prefix: "uffda-import-completion-" });
  const mainPath = join(cwd, "main.uff");
  try {
    await Deno.writeTextFile(mainPath, "");
    await Deno.writeTextFile(
      join(cwd, "dep.uff"),
      'import "./leaf.uff" L;\nexport Foo;\nexport L;\nrule Foo = L;',
    );
    await Deno.writeTextFile(join(cwd, "notes.txt"), "");
    await Deno.mkdir(join(cwd, "lib"));
    await Deno.mkdir(join(cwd, ".hidden"));

    await t.step(
      "lists modules with the path's extensions and folders, excluding itself",
      async () => {
        const source = 'import "./';
        const context = await contextAtEnd(source);
        assert(context.kind === CompletionContextKind.ModulePath);
        const items = await specifierCompletionItems(
          mainPath,
          source,
          context,
        );
        assertEquals(items.map((i) => i.label), ["dep.uff", "lib/"]);
      },
    );

    await t.step(
      "lists every file when extensions are unrestricted",
      async () => {
        const source = 'import "./';
        const context = await contextAtEnd(source);
        assert(context.kind === CompletionContextKind.ModulePath);
        const items = await specifierCompletionItems(mainPath, source, {
          ...context,
          extensions: undefined,
        });
        assertEquals(items.map((i) => i.label), [
          "dep.uff",
          "lib/",
          "notes.txt",
        ]);
      },
    );

    await t.step("starts relative paths from an empty path", async () => {
      const source = 'import "';
      const context = await contextAtEnd(source);
      assert(context.kind === CompletionContextKind.ModulePath);
      const items = await specifierCompletionItems(mainPath, source, context);
      assertEquals(items.map((i) => i.label), ["./", "../"]);
    });

    await t.step(
      "lists an unresolved module's exports from its source",
      async () => {
        const source = 'import "./dep.uff" ';
        const context = await contextAtEnd(source);
        assert(context.kind === CompletionContextKind.ImportedName);
        const session = new RuntimeSession("s", { cwd });
        const items = await nameCompletionItems(
          session,
          mainPath,
          source,
          context,
        );
        assertEquals(
          items.map((i) => [i.label, i.detail]),
          [["Foo", "exported rule"], ["L", "re-exported import"]],
        );
      },
    );

    await t.step("omits names already listed", async () => {
      const source = 'import "./dep.uff" Foo L';
      const context = await contextAtEnd(source);
      assert(context.kind === CompletionContextKind.ImportedName);
      const session = new RuntimeSession("s", { cwd });
      const items = await nameCompletionItems(
        session,
        mainPath,
        source,
        context,
      );
      assertEquals(items.map((i) => i.label), ["L"]);
    });

    await t.step("returns nothing for a missing module", async () => {
      const source = 'import "./nope.uff" ';
      const context = await contextAtEnd(source);
      assert(context.kind === CompletionContextKind.ImportedName);
      const session = new RuntimeSession("s", { cwd });
      assertEquals(
        await nameCompletionItems(session, mainPath, source, context),
        [],
      );
    });

    await t.step("returns nothing without a module path", async () => {
      const session = new RuntimeSession("s", { cwd });
      assertEquals(
        await nameCompletionItems(session, mainPath, "", {
          kind: CompletionContextKind.ImportedName,
          listed: [],
          replace: { start: 0, end: 0 },
        }),
        [],
      );
    });
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});
