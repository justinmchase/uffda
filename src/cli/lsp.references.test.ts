import { assert, assertEquals } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import type { TextEdit } from "vscode-languageserver-types";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import {
  occurrenceAt,
  planRename,
  referenceLocations,
  renameRefusal,
  type SymbolDocument,
  symbolOccurrences,
} from "./lsp.references.ts";
import { NameSymbolKind } from "./lsp.symbols.ts";

const GLOBALS = new Set(["join"]);

async function withWorkspace(
  files: Record<string, string>,
  body: (root: string, url: (name: string) => string) => Promise<void>,
) {
  const root = await Deno.makeTempDir({ prefix: "uffda-refs-" });
  try {
    for (const [name, source] of Object.entries(files)) {
      await Deno.writeTextFile(join(root, name), source);
    }
    await body(root, (name) => toFileUrl(join(root, name)).href);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

async function documentOf(
  url: string,
  source: string,
): Promise<SymbolDocument> {
  return {
    uri: url,
    moduleUrl: url,
    source,
    match: await uffdaGrammar(source),
  };
}

const DEP = "export Dep;\nrule Dep = any;\n";
const MAIN = 'import "./dep.uff" Dep;\nexport Main;\nrule Main = Dep Dep;\n';
const OTHER = 'import "./dep.uff" Dep;\nexport Other;\nrule Other = Dep;\n';
const UNRELATED = "export Dep;\nrule Dep = any;\n";

function applied(source: string, edits: TextEdit[]): string {
  const lines = source.split("\n");
  const offset = (p: { line: number; character: number }) =>
    lines.slice(0, p.line).reduce((n, line) => n + line.length + 1, 0) +
    p.character;
  return [...edits]
    .sort((a, b) => offset(b.range.start) - offset(a.range.start))
    .reduce(
      (text, edit) =>
        text.slice(0, offset(edit.range.start)) + edit.newText +
        text.slice(offset(edit.range.end)),
      source,
    );
}

Deno.test("cli.lsp.references across a workspace", async (t) => {
  await withWorkspace(
    { "dep.uff": DEP, "main.uff": MAIN, "other.uff": OTHER },
    async (root, url) => {
      await Deno.mkdir(join(root, "nested"));
      await Deno.writeTextFile(join(root, "nested", "dep.uff"), UNRELATED);
      const main = await documentOf(url("main.uff"), MAIN);
      const at = occurrenceAt(main, MAIN.indexOf("Dep Dep"), GLOBALS);
      assert(at);
      const found = await symbolOccurrences(
        at.symbol,
        at.name,
        main,
        { open: [main], root },
        GLOBALS,
      );

      await t.step("finds a declaration in its module and importers", () => {
        assertEquals(
          found.map(({ document, occurrences }) => [
            document.uri,
            occurrences.length,
          ]).sort(),
          [[url("dep.uff"), 2], [url("main.uff"), 3], [url("other.uff"), 2]],
        );
      });

      await t.step("can leave out declaring occurrences", () => {
        const all = referenceLocations(found, true);
        const references = referenceLocations(found, false);
        assertEquals(all.length - references.length, 1);
      });

      await t.step("renames every occurrence, imports included", async () => {
        const plan = await planRename(at.symbol, found, "Base", GLOBALS);
        assert(plan.ok);
        const changes = plan.edit.changes!;
        assertEquals(
          applied(MAIN, changes[url("main.uff")]),
          'import "./dep.uff" Base;\nexport Main;\nrule Main = Base Base;\n',
        );
        assertEquals(
          applied(DEP, changes[url("dep.uff")]),
          "export Base;\nrule Base = any;\n",
        );
        assertEquals(changes[url("nested/dep.uff")], undefined);
      });

      await t.step("refuses a name already in use", async () => {
        const plan = await planRename(at.symbol, found, "Main", GLOBALS);
        assert(!plan.ok);
        assert(plan.message.includes("already names"));
      });

      await t.step(
        "refuses a name the grammar does not read back",
        async () => {
          for (const bad of ["rule", "a b", "9x", ""]) {
            const plan = await planRename(at.symbol, found, bad, GLOBALS);
            assert(!plan.ok, `renaming to ${JSON.stringify(bad)}`);
          }
        },
      );
    },
  );
});

Deno.test("cli.lsp.references in one document", async (t) => {
  const source = "export Main;\nrule Main = n:string -> (join n n);\n";
  const document = await documentOf("file:///nowhere/main.uff", source);

  await t.step("renames a local binding within its document", async () => {
    const at = occurrenceAt(document, source.indexOf("n);"), GLOBALS);
    assert(at);
    const found = await symbolOccurrences(
      at.symbol,
      at.name,
      document,
      { open: [document], root: "/nowhere" },
      GLOBALS,
    );
    const plan = await planRename(at.symbol, found, "text", GLOBALS);
    assert(plan.ok);
    assertEquals(
      applied(source, plan.edit.changes![document.uri]),
      "export Main;\nrule Main = text:string -> (join text text);\n",
    );
  });

  await t.step("refuses to rename a runtime global", async () => {
    const at = occurrenceAt(document, source.indexOf("join"), GLOBALS);
    assert(at);
    assertEquals(at.symbol.kind, NameSymbolKind.Global);
    assert(renameRefusal(at.symbol));
    const plan = await planRename(at.symbol, [], "x", GLOBALS);
    assert(!plan.ok);
  });

  await t.step("refuses a declaration outside the workspace", async () => {
    const importer = 'import "./gone.uff" Gone;\nrule Main = Gone;\n';
    const doc = await documentOf("file:///nowhere/main.uff", importer);
    const at = occurrenceAt(doc, importer.lastIndexOf("Gone"), GLOBALS);
    assert(at);
    const found = await symbolOccurrences(
      at.symbol,
      at.name,
      doc,
      { open: [doc], root: "/nowhere" },
      GLOBALS,
    );
    const plan = await planRename(at.symbol, found, "Here", GLOBALS);
    assert(!plan.ok);
    assert(plan.message.includes("outside the workspace"));
  });
});
