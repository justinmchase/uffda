import { assert, assertEquals } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import {
  importCompletionContext,
  ImportCompletionContextKind,
  nameCompletionItems,
  specifierCompletionItems,
} from "./lsp.import_completion.ts";
import { RuntimeSession } from "./mcp.session.ts";

function contextAtEnd(source: string) {
  return importCompletionContext(source, source.length);
}

Deno.test("cli.lsp.import_completion importCompletionContext", async (t) => {
  await t.step("classifies a position inside the specifier", () => {
    const source = 'export A;\nimport "../lib/fo';
    const context = contextAtEnd(source);
    assert(context?.kind === ImportCompletionContextKind.Specifier);
    assertEquals(context.typed, "../lib/fo");
    assertEquals(source.slice(context.replace.start), "fo");
  });

  await t.step("replaces the whole segment under the cursor", () => {
    const source = 'import "./ab.uff" A;';
    const context = importCompletionContext(source, 'import "./a'.length);
    assert(context?.kind === ImportCompletionContextKind.Specifier);
    assertEquals(
      source.slice(context.replace.start, context.replace.end),
      "ab.uff",
    );
  });

  await t.step("classifies the name list after the specifier", () => {
    const context = contextAtEnd('import "./dep.uff" Foo Ba');
    assert(context?.kind === ImportCompletionContextKind.Names);
    assertEquals(context.specifier, "./dep.uff");
    assertEquals(context.listed, ["Foo"]);
    assertEquals(context.replace.end - context.replace.start, 2);
  });

  await t.step("offers an empty name slot after whitespace", () => {
    const context = contextAtEnd('import "./dep.uff" ');
    assert(context?.kind === ImportCompletionContextKind.Names);
    assertEquals(context.listed, []);
    assertEquals(context.replace.start, context.replace.end);
  });

  await t.step("ignores non-import positions", () => {
    assertEquals(contextAtEnd('rule A = "x'), undefined);
    assertEquals(contextAtEnd('import "./dep.uff" Foo;'), undefined);
    assertEquals(contextAtEnd("export Main"), undefined);
  });
});

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

    await t.step("lists .uff files and folders, excluding itself", async () => {
      const source = 'import "./';
      const context = contextAtEnd(source);
      assert(context?.kind === ImportCompletionContextKind.Specifier);
      const items = await specifierCompletionItems(mainPath, source, context);
      assertEquals(items.map((i) => i.label), ["dep.uff", "lib/"]);
    });

    await t.step(
      "starts relative specifiers from an empty string",
      async () => {
        const source = 'import "';
        const context = contextAtEnd(source);
        assert(context?.kind === ImportCompletionContextKind.Specifier);
        const items = await specifierCompletionItems(mainPath, source, context);
        assertEquals(items.map((i) => i.label), ["./", "../"]);
      },
    );

    await t.step(
      "lists an unresolved module's exports from its source",
      async () => {
        const source = 'import "./dep.uff" ';
        const context = contextAtEnd(source);
        assert(context?.kind === ImportCompletionContextKind.Names);
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
      const source = 'import "./dep.uff" Foo ';
      const context = contextAtEnd(source);
      assert(context?.kind === ImportCompletionContextKind.Names);
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
      const context = contextAtEnd(source);
      assert(context?.kind === ImportCompletionContextKind.Names);
      const session = new RuntimeSession("s", { cwd });
      assertEquals(
        await nameCompletionItems(session, mainPath, source, context),
        [],
      );
    });

    assert(toFileUrl(mainPath).href.startsWith("file://"));
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});
