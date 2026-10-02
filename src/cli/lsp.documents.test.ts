import { assert, assertEquals, assertRejects } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import type { CompletionItem } from "vscode-languageserver-types";
import { LspDocumentManager, positionToOffset } from "./lsp.documents.ts";
import { SEMANTIC_TOKENS_LEGEND } from "./semantic_tokens.ts";

function partitionGlobals(
  items: CompletionItem[],
): [CompletionItem[], CompletionItem[]] {
  const isGlobal = (item: CompletionItem) => item.detail === "global func";
  return [items.filter((item) => !isGlobal(item)), items.filter(isGlobal)];
}

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
    "semanticTokens colors expression references by what they name",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const source =
        "export Main;\nrule Other = any;\nrule Main = x:any -> (f x Other);";
      await manager.open("inline:///refs", source);
      const tokens = await manager.semanticTokens("inline:///refs");
      assert(tokens);
      const typeIndex = SEMANTIC_TOKENS_LEGEND.tokenTypes.indexOf("type");
      const variableIndex = SEMANTIC_TOKENS_LEGEND.tokenTypes.indexOf(
        "variable",
      );
      let line = 0;
      let character = 0;
      const typed = new Map<string, number>();
      for (let i = 0; i < tokens.data.length; i += 5) {
        const [deltaLine, deltaStart, length, tokenType] = tokens.data.slice(
          i,
          i + 4,
        );
        line += deltaLine;
        character = deltaLine === 0 ? character + deltaStart : deltaStart;
        const text = source.split("\n")[line].slice(
          character,
          character + length,
        );
        typed.set(text, tokenType);
      }
      assertEquals(typed.get("Other"), typeIndex);
      assertEquals(typed.get("x"), variableIndex);
    },
  );

  await t.step(
    "references, prepareRename, and rename span the workspace",
    async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-lsp-refs-" });
      try {
        const depPath = join(root, "dep.uff");
        const mainPath = join(root, "main.uff");
        await Deno.writeTextFile(depPath, "export Dep;\nrule Dep = any;\n");
        await Deno.writeTextFile(mainPath, "export Main;\nrule Main = any;\n");
        const main = toFileUrl(mainPath).href;
        const dep = toFileUrl(depPath).href;
        const manager = new LspDocumentManager(root);
        const unsaved =
          'import "./dep.uff" Dep;\nexport Main;\nrule Main = Dep -> (join Dep);\n';
        await manager.open(main, unsaved);
        const position = {
          line: 2,
          character: "rule Main = D".length,
        };

        const locations = await manager.references(main, position, true);
        assertEquals(
          locations.map((l) => l.uri).sort(),
          [dep, dep, main, main, main],
        );
        assertEquals(
          (await manager.references(main, position, false)).length,
          4,
        );

        assertEquals(await manager.prepareRename(main, position), {
          range: {
            start: { line: 2, character: 12 },
            end: { line: 2, character: 15 },
          },
          placeholder: "Dep",
        });
        const joinAt = {
          line: 2,
          character: "rule Main = Dep -> (jo".length,
        };
        const refused = await manager.prepareRename(main, joinAt);
        assert(refused && "refusal" in refused);
        assertEquals(
          await manager.prepareRename(main, { line: 1, character: 0 }),
          null,
        );

        const plan = await manager.rename(main, position, "Base");
        assert(plan.ok);
        assertEquals(Object.keys(plan.edit.changes!).sort(), [dep, main]);
        assertEquals(plan.edit.changes![main].length, 3);
        assertEquals(
          await Deno.readTextFile(depPath),
          "export Dep;\nrule Dep = any;\n",
          "rename never writes files",
        );
      } finally {
        await Deno.remove(root, { recursive: true });
      }
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
    "definition goes to local bindings before declarations",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const uri = "inline:///local-definition";
      const lines = [
        "export Main;",
        "rule Other = any;",
        "rule Main = Other:any -> (map [Other] <x:any> -> x);",
      ];
      await manager.open(uri, lines.join("\n"));
      const definitionOf = async (character: number) =>
        (await manager.definition(uri, { line: 2, character }))
          .map((l) =>
            `${l.uri}:${l.range.start.line}:${l.range.start.character}`
          );

      assertEquals(
        await definitionOf(lines[2].indexOf("Other]")),
        [`${uri}:2:12`],
        "a capture shadowing a rule",
      );
      assertEquals(
        await definitionOf(lines[2].lastIndexOf("x")),
        [`${uri}:2:${lines[2].indexOf("x:any")}`],
        "a lambda parameter",
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
    "completion offers in-scope declarations at a name reference",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const uri = "inline:///completion";
      await manager.open(
        uri,
        "export Main;\nrule Main = Helper;\nrule Helper = any;",
      );
      const items = await manager.completion(uri, {
        line: 1,
        character: "rule Main = Hel".length,
      });
      assertEquals(items.map((item) => item.label).sort(), ["Helper", "Main"]);
      const edit = items[0].textEdit;
      assert(edit && "range" in edit);
      assertEquals(edit.range, {
        start: { line: 1, character: "rule Main = ".length },
        end: { line: 1, character: "rule Main = Hel".length },
      });

      assertEquals(
        await manager.completion(uri, { line: 0, character: 0 }),
        [],
      );
    },
  );

  await t.step(
    "completion offers local bindings first, shadowing declarations",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const uri = "inline:///completion-locals";
      await manager.open(
        uri,
        "export Main;\nfunc json<v:any> = v;\nfunc text<v:any> = v;\n" +
          "rule Main = json:string -> (json json);",
      );
      const items = await manager.completion(uri, {
        line: 3,
        character: "rule Main = json:string -> (j".length,
      });
      const [locals, globals] = partitionGlobals(items);
      assertEquals(
        locals.map((item) => `${item.label}:${item.detail}`),
        ["json:variable", "text:func"],
      );
      const names = globals.map((item) => item.label);
      assert(names.includes("coalesce"));
      assert(!names.includes("json"), "the local json shadows the global");
      const coalesce = globals.find((item) => item.label === "coalesce");
      assert(
        coalesce?.documentation && typeof coalesce.documentation !== "string" &&
          coalesce.documentation.value.includes(
            "The first argument that is neither null nor undefined.",
          ),
      );
    },
  );

  await t.step(
    "completion offers names at an empty argument position",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const uri = "inline:///completion-empty";
      const line = "rule Main = n:string -> (text ";
      await manager.open(
        uri,
        `export Main;\nfunc text<v:any> = v;\n${line}n);`,
      );
      const items = await manager.completion(uri, {
        line: 2,
        character: line.length,
      });
      assertEquals(
        partitionGlobals(items)[0].map((item) =>
          `${item.label}:${item.detail}`
        ),
        ["n:variable", "text:func"],
      );
    },
  );

  await t.step(
    "completion offers no globals where funcs are not named",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      const uri = "inline:///completion-no-globals";
      await manager.open(uri, "export Main;\nrule Main = any;");
      const items = await manager.completion(uri, {
        line: 0,
        character: "export M".length,
      });
      assertEquals(partitionGlobals(items)[1], []);
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

        const files = await manager.completion(uri, {
          line: 0,
          character: 10,
        });
        assertEquals(files.map((i) => i.label), ["dep.uff", "lib/"]);

        await manager.change(uri, [{ text: 'import "./dep.uff" Foo B' }]);
        const names = await manager.completion(uri, {
          line: 0,
          character: 24,
        });
        assertEquals(names.map((i) => i.label), ["Bar"]);

        await manager.change(uri, [{ text: 'rule A = "' }]);
        assertEquals(
          await manager.completion(uri, { line: 0, character: 10 }),
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

Deno.test("cli.lsp.documents LspDocumentManager.format", async (t) => {
  const uri = "file:///workspace/format.uff";

  await t.step("is undefined for a document that is not open", async () => {
    const manager = new LspDocumentManager(Deno.cwd());
    assertEquals(await manager.format(uri), undefined);
  });

  await t.step(
    "replaces the whole document with its formatted text",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open(uri, 'rule   A =  "a" ;');
      assertEquals(await manager.format(uri), [{
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 17 },
        },
        newText: 'rule A = "a";\n',
      }]);
    },
  );

  await t.step(
    "returns no edits for canonical text or an unclean parse",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open(uri, 'rule A = "a";\n');
      assertEquals(await manager.format(uri), []);
      await manager.change(uri, [{ text: "rule = ;" }]);
      assertEquals(await manager.format(uri), []);
    },
  );
});

Deno.test("cli.lsp.documents LspDocumentManager.toggleComment", async (t) => {
  const uri = "file:///workspace/toggle.uff";
  const at = (line: number, character: number) => ({ line, character });

  await t.step("is undefined for a document that is not open", async () => {
    const manager = new LspDocumentManager(Deno.cwd());
    assertEquals(
      await manager.toggleComment(uri, { start: at(0, 0), end: at(0, 0) }),
      undefined,
    );
  });

  await t.step(
    "comments the whole lines the range touches",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open(uri, "rule A =\r\n  | a\r\n  | b\r\n;\r\n");
      assertEquals(
        await manager.toggleComment(uri, { start: at(1, 3), end: at(2, 1) }),
        [{
          range: { start: at(1, 0), end: at(2, 5) },
          newText: "  # | a\r\n  # | b",
        }],
      );
    },
  );

  await t.step(
    "uncomments lines that are all comments, leaving out a line the range only reaches the start of",
    async () => {
      const manager = new LspDocumentManager(Deno.cwd());
      await manager.open(uri, "# a\n#  b\nrule A = a;\n");
      assertEquals(
        await manager.toggleComment(uri, { start: at(0, 0), end: at(2, 0) }),
        [{ range: { start: at(0, 0), end: at(1, 4) }, newText: "a\n b" }],
      );
    },
  );

  await t.step("returns no edits when nothing changes", async () => {
    const manager = new LspDocumentManager(Deno.cwd());
    await manager.open(uri, "rule A = a;\n\n");
    assertEquals(
      await manager.toggleComment(uri, { start: at(1, 0), end: at(1, 0) }),
      [],
    );
  });
});
