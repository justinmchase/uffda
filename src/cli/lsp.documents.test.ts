import { assert, assertEquals, assertRejects } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import { LspDocumentManager, positionToOffset } from "./lsp.documents.ts";

Deno.test("cli.lsp.documents positionToOffset", async (t) => {
  const source = "line0\nline1\nline2";

  await t.step("resolves a position on the first line", () => {
    assertEquals(positionToOffset(source, { line: 0, character: 3 }), 3);
  });

  await t.step("resolves a position on a later line", () => {
    // "line0\n" is 6 chars, so line 1 starts at offset 6.
    assertEquals(positionToOffset(source, { line: 1, character: 2 }), 8);
  });

  await t.step("clamps a character past the line's end", () => {
    assertEquals(positionToOffset(source, { line: 0, character: 999 }), 5);
  });

  await t.step("clamps a line past the document's end", () => {
    assertEquals(
      positionToOffset(source, { line: 99, character: 0 }),
      source.length,
    );
  });
});

Deno.test("cli.lsp.documents LspDocumentManager", async (t) => {
  await t.step("open reports no diagnostics for valid source", async () => {
    const manager = new LspDocumentManager(Deno.cwd());
    const diagnostics = await manager.open(
      "inline:///a",
      "export Main; rule Main = any;",
    );
    assertEquals(diagnostics, []);
  });

  await t.step("open reports a diagnostic for invalid source", async () => {
    const manager = new LspDocumentManager(Deno.cwd());
    const diagnostics = await manager.open("inline:///b", "rule Main = ");
    assertEquals(diagnostics.length, 1);
  });

  await t.step(
    "a ranged change reuses incremental reparse and stays correct",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const source = 'export Main; rule Main = "a";';
      await manager.open("inline:///c", source);

      // Replace the "a" literal with "b".
      const start = source.indexOf('"a"') + 1;
      const diagnostics = await manager.change("inline:///c", [{
        range: {
          start: offsetToPosition(source, start),
          end: offsetToPosition(source, start + 1),
        },
        text: "b",
      }]);
      assertEquals(diagnostics, []);
    },
  );

  await t.step(
    "a full-document replacement (no range) falls back to a full reload",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open("inline:///d", "rule Main = any");
      const diagnostics = await manager.change("inline:///d", [{
        text: "export Main; rule Main = any;",
      }]);
      assertEquals(diagnostics, []);
    },
  );

  await t.step(
    "a change after a failed open still reloads correctly once fixed",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open("inline:///e", "rule Main = ");
      const diagnostics = await manager.change("inline:///e", [{
        text: "export Main; rule Main = any;",
      }]);
      assertEquals(diagnostics, []);
    },
  );

  await t.step(
    "un-awaited changes apply in order and match a fresh open",
    async () => {
      const initial = "export Main;\n\nrule Main = any;";
      const typed = "rule B = Main;";
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open("inline:///burst", initial);
      // Clients send didChange without waiting; each keystroke patches the
      // state the previous one produced.
      const pending = [...typed].map((ch, i) =>
        manager.change("inline:///burst", [{
          range: {
            start: { line: 1, character: i },
            end: { line: 1, character: i },
          },
          text: ch,
        }])
      );
      const tokens = await manager.semanticTokens("inline:///burst");
      const diagnostics = await pending.at(-1);

      const final = `export Main;\n${typed}\nrule Main = any;`;
      const fresh = new LspDocumentManager(Deno.cwd());
      assertEquals(diagnostics, await fresh.open("inline:///fresh", final));
      assertEquals(
        tokens?.data,
        (await fresh.semanticTokens("inline:///fresh"))?.data,
      );
      assertEquals(diagnostics, []);
    },
  );

  await t.step("close tears down the document's session", async () => {
    const manager = new LspDocumentManager(Deno.cwd());
    await manager.open("inline:///f", "export Main; rule Main = any;");
    await manager.close("inline:///f");
    await assertRejects(() => manager.change("inline:///f", [{ text: "" }]));
  });

  await t.step(
    "semanticTokens derives classifications from the retained parse tree",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open(
        "inline:///g",
        "export Main; rule Main = any;",
      );
      const tokens = await manager.semanticTokens("inline:///g");
      assert(tokens);
      assertEquals(tokens.data.length > 0, true);
      assertEquals(tokens.data.length % 5, 0);
    },
  );

  await t.step(
    "semanticTokens still returns tokens after a parse failure",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open("inline:///h", "export Main; rule Main = ");
      const tokens = await manager.semanticTokens("inline:///h");
      assert(tokens);
      assertEquals(tokens.data.length > 0, true);
    },
  );

  await t.step(
    "semanticTokens returns undefined for a document that was never opened",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      assertEquals(
        await manager.semanticTokens("inline:///missing"),
        undefined,
      );
    },
  );

  await t.step(
    "hover describes a resolved rule under the cursor",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const source = "export Main; rule Main = any;";
      await manager.open("inline:///hover", source);
      const hover = await manager.hover(
        "inline:///hover",
        offsetToPosition(source, source.indexOf("Main")),
      );
      assert(hover);
      assertEquals(
        typeof hover.contents === "object" &&
          "value" in hover.contents &&
          hover.contents.value.includes("(exported rule) `Main`"),
        true,
      );
    },
  );

  await t.step(
    "completion offers the document's in-scope declarations",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open(
        "inline:///completion",
        "export Main; rule Main = any; rule Helper = any;",
      );
      const labels = (await manager.completion("inline:///completion", {
        line: 0,
        character: 0,
      }))
        .map((item) => item.label)
        .sort();
      assertEquals(labels, ["Helper", "Main"]);
    },
  );

  await t.step(
    "completion returns no items for a document that was never opened",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      assertEquals(
        await manager.completion("inline:///missing", {
          line: 0,
          character: 0,
        }),
        [],
      );
    },
  );

  await t.step(
    "completion inside an import offers files, then the module's exports",
    async () => {
      const cwd = await Deno.makeTempDir({ prefix: "uffda-lsp-imports-" });
      try {
        await Deno.writeTextFile(
          join(cwd, "dep.uff"),
          "export Foo;\nexport Bar;\nrule Foo = any;\nrule Bar = any;",
        );
        await Deno.mkdir(join(cwd, "lib"));
        const uri = toFileUrl(join(cwd, "main.uff")).href;
        const manager = new LspDocumentManager(cwd);
        await manager.open(uri, 'import "./');

        const files = await manager.completion(
          uri,
          { line: 0, character: 10 },
          "/",
        );
        assertEquals(files.map((i) => i.label), ["dep.uff", "lib/"]);

        await manager.change(uri, [{ text: 'import "./dep.uff" Foo ' }]);
        const names = await manager.completion(uri, {
          line: 0,
          character: 23,
        });
        assertEquals(names.map((i) => i.label), ["Bar"]);

        await manager.change(uri, [{ text: 'rule A = "' }]);
        assertEquals(
          await manager.completion(uri, { line: 0, character: 10 }, '"'),
          [],
        );
      } finally {
        await Deno.remove(cwd, { recursive: true });
      }
    },
  );

  await t.step(
    "hover returns null for a document that was never opened",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      assertEquals(
        await manager.hover("inline:///missing", { line: 0, character: 0 }),
        null,
      );
    },
  );
});

function offsetToPosition(
  source: string,
  offset: number,
): { line: number; character: number } {
  const before = source.slice(0, offset);
  const lines = before.split("\n");
  return { line: lines.length - 1, character: lines.at(-1)?.length ?? 0 };
}
