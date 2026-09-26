import { assert, assertEquals } from "@std/assert";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import {
  formatDescribedDeclarationMarkdown,
  hoverAtPosition,
  identifierAtOffset,
} from "./lsp.hover.ts";
import { RuntimeSession } from "./mcp.session.ts";
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
  await t.step("renders kind, pattern, attributes, and metadata", () => {
    const markdown = formatDescribedDeclarationMarkdown({
      moduleUrl: "file:///x.uff",
      name: "Main",
      kind: "rule",
      exported: true,
      pattern: { kind: PatternKind.Any },
      parameters: [],
      attributes: [{ decorator: "Loud", args: [] }],
      metadata: { Loud: { shout: true } },
    });
    assert(markdown.includes("(exported rule) `Main`"));
    assert(markdown.includes("**pattern:** `any`"));
    assert(markdown.includes("`Loud`"));
    assert(markdown.includes("**metadata:**"));
  });
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
      const hover = hoverAtPosition(
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
      const hover = hoverAtPosition(
        session,
        MODULE,
        offsetToPosition(MODULE, offset),
        state.match,
      );
      assertEquals(hover, null);
    },
  );
});
