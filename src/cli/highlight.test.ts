import { assert, assertEquals } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import {
  HighlightRole,
  highlightSource,
  renderHighlightAnsi,
} from "./highlight.ts";

/**
 * Coverage for the source-highlighting tool (see
 * `.agents/requirements/mcp-server/009-source-highlighting-tool.requirement.md`
 * and `mcp-server.spec.md#source-highlighting-tool`).
 */

function assertFullCoverage(
  spans: { offset: number; length: number }[],
  sourceLength: number,
) {
  let cursor = 0;
  for (const span of spans) {
    assertEquals(span.offset, cursor, "spans must be contiguous, no gaps");
    cursor += span.length;
  }
  assertEquals(cursor, sourceLength, "spans must cover the entire source");
}

Deno.test("cli.highlight classifies uffda module source by syntactic role", async (t) => {
  await t.step(
    "classifies reserved words as keywords, not identifiers",
    async () => {
      const source = 'import "./x.uff" A;\nexport B;\nrule B = any;\n';
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(result.ok);
      assertFullCoverage(result.spans, source.length);

      const keywordTexts = result.spans
        .filter((s) => s.role === HighlightRole.Keyword)
        .map((s) => s.text);
      assertEquals(keywordTexts, ["import", "export", "rule"]);

      // The rule's own name ("B") is an ordinary identifier, not a keyword.
      const identifierTexts = result.spans
        .filter((s) => s.role === HighlightRole.Identifier)
        .map((s) => s.text);
      assertEquals(identifierTexts, ["A", "B", "B", "any"]);
    },
  );

  await t.step(
    "classifies decorator/func declarations' keywords",
    async () => {
      const source =
        "decorator Loud = { shout: true };\n[Loud]\nfunc F<a:number> = a;\n";
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(result.ok);
      assertFullCoverage(result.spans, source.length);
      const keywordTexts = result.spans
        .filter((s) => s.role === HighlightRole.Keyword)
        .map((s) => s.text);
      assertEquals(keywordTexts, ["decorator", "func"]);
    },
  );

  await t.step("classifies comments distinctly from code", async () => {
    const source = "# a comment\nrule A = any;\n";
    const result = await highlightSource(source, CliLanguage.FullUffda);
    assert(result.ok);
    assertFullCoverage(result.spans, source.length);
    const comment = result.spans.find((s) => s.role === HighlightRole.Comment);
    assertEquals(comment?.text, "# a comment");
  });

  await t.step(
    "classifies quoted string content as string, not identifier/punctuation",
    async () => {
      const source = 'import "./sub/mod.uff" A;\n';
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(result.ok);
      assertFullCoverage(result.spans, source.length);
      const stringText = result.spans
        .filter((s) => s.role === HighlightRole.String)
        .map((s) => s.text)
        .join("");
      assertEquals(stringText, '"./sub/mod.uff"');
    },
  );

  await t.step(
    "the same source, highlighted twice, produces identical output",
    async () => {
      const source = 'import "./x.uff" A;\nexport A;\n';
      const first = await highlightSource(source, CliLanguage.FullUffda);
      const second = await highlightSource(source, CliLanguage.FullUffda);
      assertEquals(first, second);
    },
  );

  await t.step(
    "source that fails to parse still returns best-effort, gap-free spans plus a diagnostic",
    async () => {
      // Missing semicolon after the import declaration.
      const source = 'import "x.uff" A\nrule B = any;\n';
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(!result.ok);
      assertEquals(result.error.code, "CLI_STREAM_PARSE_FAILURE");
      assertEquals(result.error.phase, "parse");
      assertFullCoverage(result.spans, source.length);
      // The portion that did parse successfully is still classified.
      assertEquals(
        result.spans.find((s) => s.role === HighlightRole.Keyword)?.text,
        "import",
      );
    },
  );

  await t.step("renders spans as ANSI-annotated text", async () => {
    const source = "rule A = any;\n";
    const result = await highlightSource(source, CliLanguage.FullUffda);
    assert(result.ok);
    const rendered = renderHighlightAnsi(result.spans);
    // deno-lint-ignore no-control-regex
    const withoutAnsi = rendered.replace(/\x1b\[[0-9;]*m/g, "");
    assertEquals(withoutAnsi, source);
  });
});

Deno.test("cli.highlight covers pattern/expression sub-language source without gaps", async (t) => {
  await t.step("pattern language source", async () => {
    const source = '"a" | "b"';
    const result = await highlightSource(source, CliLanguage.Pattern);
    assert(result.ok);
    assertFullCoverage(result.spans, source.length);
  });

  await t.step("expression language source", async () => {
    const source = "(add 1 2)";
    const result = await highlightSource(source, CliLanguage.Expression);
    assert(result.ok);
    assertFullCoverage(result.spans, source.length);
  });
});
