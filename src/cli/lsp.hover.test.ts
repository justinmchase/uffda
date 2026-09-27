import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import {
  formatDescribedDeclarationMarkdown,
  hoverAtPosition,
  identifierAtOffset,
} from "./lsp.hover.ts";
import { type DescribedDeclaration, RuntimeSession } from "./mcp.session.ts";
import { offsetToPosition } from "./lsp.positions.ts";

const MODULE = `export Main Loud Greet;
decorator Loud = { shout: true };
[Loud]
rule Main = any;
func Greet = "hi";`;

Deno.test("cli.lsp.hover identifierAtOffset", async (t) => {
  const source = "rule Main = any;";
  const match = await uffdaGrammar(source);

  await t.step("finds the identifier token under the cursor", () => {
    const hit = identifierAtOffset(source, source.indexOf("Main") + 1, match);
    assertEquals(hit, {
      name: "Main",
      start: source.indexOf("Main"),
      end: source.indexOf("Main") + 4,
    });
  });

  await t.step("returns undefined on a keyword or punctuation", () => {
    assertEquals(identifierAtOffset(source, 1, match), undefined);
    assertEquals(
      identifierAtOffset(source, source.indexOf("="), match),
      undefined,
    );
  });

  await t.step("returns undefined without a parse tree", () => {
    assertEquals(
      identifierAtOffset(source, source.indexOf("Main") + 1),
      undefined,
    );
  });
});

Deno.test("cli.lsp.hover formatDescribedDeclarationMarkdown", async (t) => {
  const declaration: DescribedDeclaration = {
    moduleUrl: "file:///x.uff",
    name: "Main",
    kind: "rule",
    exported: true,
    pattern: { kind: PatternKind.Any },
    parameters: [],
    attributes: [
      { decorator: "Highlight", args: [{ role: "string" }] },
      { decorator: "Keyword", args: [] },
    ],
    metadata: {
      Highlight: { role: "string" },
      Keyword: { role: "keyword" },
    },
  };

  await t.step("shows the declaration source and computed metadata", () => {
    const source =
      '[Highlight { role: "string" }]\n[Keyword]\nrule Main = any;';
    const markdown = formatDescribedDeclarationMarkdown(declaration, source);
    assertEquals(
      markdown,
      [
        "(exported rule) `Main`",
        ["```uffda", source, "```"].join("\n"),
        '- `Keyword` → `{ role: "keyword" }`',
      ].join("\n\n"),
    );
  });

  await t.step("summarizes pattern and attributes without source", () => {
    const markdown = formatDescribedDeclarationMarkdown(declaration);
    assertEquals(
      markdown,
      [
        "(exported rule) `Main`",
        "**pattern:** `any`",
        "**attributes:**",
        [
          '- `Highlight({ role: "string" })`',
          '- `Keyword` → `{ role: "keyword" }`',
        ].join("\n"),
      ].join("\n\n"),
    );
  });

  await t.step("truncates long declaration source", () => {
    const source = Array.from({ length: 30 }, (_, i) => `line${i}`).join("\n");
    const markdown = formatDescribedDeclarationMarkdown(declaration, source);
    assert(markdown.includes("line19\n  …\n```"));
    assert(!markdown.includes("line20"));
  });
});

Deno.test("cli.lsp.hover shows a file-backed declaration's source", async () => {
  const cwd = await Deno.makeTempDir({ prefix: "uffda-lsp-hover-" });
  try {
    const path = join(cwd, "main.uff");
    const source =
      "export Main;\n\n# docs\nrule Main =\n  Other;\n\nrule Other = any;\n";
    await Deno.writeTextFile(path, source);
    const session = new RuntimeSession("hover-src", { cwd });
    assertEquals((await session.load(source, path)).ok, true);
    const state = session.getLatestParseState();
    assert(state);
    const hover = await hoverAtPosition(
      session,
      source,
      offsetToPosition(source, source.indexOf("Other;") + 1),
      state.match,
    );
    const contents = hover?.contents;
    assert(contents && typeof contents === "object" && "value" in contents);
    assertEquals(
      contents.value,
      "(rule) `Other`\n\n```uffda\nrule Other = any;\n```",
    );
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});

Deno.test("cli.lsp.hover hoverAtPosition", async (t) => {
  await t.step(
    "describes the rule under the cursor via session.describe",
    async () => {
      const session = new RuntimeSession("hover-1");
      const load = await session.load(MODULE);
      assertEquals(load.ok, true);
      const state = session.getLatestParseState();
      assert(state);

      const offset = MODULE.indexOf("Main", MODULE.indexOf("rule"));
      const hover = await hoverAtPosition(
        session,
        MODULE,
        offsetToPosition(MODULE, offset),
        state.match,
      );
      assert(hover);
      const contents = hover.contents;
      assert(typeof contents === "object" && !Array.isArray(contents));
      assertEquals("kind" in contents && contents.kind, "markdown");
      assertEquals(
        "value" in contents &&
          typeof contents.value === "string" &&
          contents.value.includes("(exported rule) `Main`"),
        true,
      );
      assertEquals(hover.range?.start, offsetToPosition(MODULE, offset));
    },
  );

  await t.step(
    "returns null for an unresolved identifier without erroring",
    async () => {
      const session = new RuntimeSession("hover-2");
      await session.load(MODULE);
      const state = session.getLatestParseState();
      assert(state);
      // `any` is a pattern atom, not a declaration name in this module.
      const offset = MODULE.lastIndexOf("any");
      const hover = await hoverAtPosition(
        session,
        MODULE,
        offsetToPosition(MODULE, offset),
        state.match,
      );
      assertEquals(hover, null);
    },
  );
});

Deno.test("cli.lsp.hover locals and globals", async (t) => {
  const source = `export Main Pair Words;
rule Pair<P> = a:P b:P -> [a b];
rule Main = n:string -> (join (map [n] <x:any> -> x) ",");
func Words<s:string> = (join s " ");
`;
  const session = new RuntimeSession("hover-locals");
  assertEquals((await session.load(source)).ok, true);
  const state = session.getLatestParseState();
  assert(state);

  const hoverText = async (offset: number) => {
    const hover = await hoverAtPosition(
      session,
      source,
      offsetToPosition(source, offset),
      state.match,
    );
    const contents = hover?.contents;
    return contents && typeof contents === "object" && "value" in contents
      ? contents.value
      : undefined;
  };

  await t.step("describes a runtime global from its metadata", async () => {
    assertEquals(
      await hoverText(source.indexOf("join")),
      [
        "(global func) `join`",
        "```uffda\n(join self separator?)\n```",
        "Joins an array's elements into a string with a separator.",
      ].join("\n\n"),
    );
    assert(
      (await hoverText(source.indexOf("map")))?.startsWith(
        "(global func) `map`",
      ),
    );
  });

  await t.step("describes a captured variable by its binding", async () => {
    const expected = "(variable) `n`\n\n```uffda\nn:string\n```";
    assertEquals(await hoverText(source.indexOf("[n]") + 1), expected);
    assertEquals(await hoverText(source.indexOf("n:string")), expected);
    assertEquals(
      await hoverText(source.indexOf("(join s") + 6),
      "(variable) `s`\n\n```uffda\ns:string\n```",
    );
  });

  await t.step("scopes lambda parameters to the lambda", async () => {
    assertEquals(
      await hoverText(source.indexOf("-> x") + 3),
      "(variable) `x`\n\n```uffda\nx:any\n```",
    );
  });

  await t.step("describes a rule parameter in pattern position", async () => {
    assertEquals(
      await hoverText(source.indexOf("a:P") + 2),
      "(parameter) `P` of rule `Pair`",
    );
  });
});
