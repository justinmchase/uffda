import { assert, assertEquals, assertRejects } from "@std/assert";
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

  await t.step("close tears down the document's session", async () => {
    const manager = new LspDocumentManager(Deno.cwd());
    await manager.open("inline:///f", "export Main; rule Main = any;");
    manager.close("inline:///f");
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
      const tokens = manager.semanticTokens("inline:///g");
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
      const tokens = manager.semanticTokens("inline:///h");
      assert(tokens);
      assertEquals(tokens.data.length > 0, true);
    },
  );

  await t.step(
    "semanticTokens returns undefined for a document that was never opened",
    () => {
      const manager = new LspDocumentManager(Deno.cwd());
      assertEquals(manager.semanticTokens("inline:///missing"), undefined);
    },
  );

  await t.step(
    "hover describes a resolved rule under the cursor",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const source = "export Main; rule Main = any;";
      await manager.open("inline:///hover", source);
      const hover = manager.hover(
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
    "hover returns null for a document that was never opened",
    () => {
      const manager = new LspDocumentManager(Deno.cwd());
      assertEquals(
        manager.hover("inline:///missing", { line: 0, character: 0 }),
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
