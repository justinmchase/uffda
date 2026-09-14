import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { patternGrammar } from "../lang/pattern/pattern.lang.ts";
import { MatchKind } from "../match.ts";
import { CliLanguage } from "./contract.ts";
import { highlightSource } from "./highlight.ts";
import {
  type DisplayNode,
  highlightResultToDisplayNodes,
  matchResultToDisplayNodes,
  renderDisplayHtml,
} from "./display_transform.ts";

/**
 * Coverage for the shared structured-result-to-markup transform backing the
 * session display surface tool (see
 * `.agents/requirements/mcp-server/011-session-display-surface-tool.requirement.md`):
 * both a highlighting result and a match result tree must convert into the
 * same `DisplayNode` shape and render through the same `renderDisplayHtml`.
 */

Deno.test("cli.display_transform converts a highlighting result to display nodes", async (t) => {
  await t.step("one leaf DisplayNode per span, in source order", async () => {
    const result = await highlightSource(
      "rule A = any;\n",
      CliLanguage.FullUffda,
    );
    assert(result.ok);
    const nodes = highlightResultToDisplayNodes(result);
    assertEquals(nodes.length, result.spans.length);
    assertEquals(nodes.map((n) => n.label), result.spans.map((s) => s.text));
    // Keyword span gets the keyword CSS class, not a generic one.
    const ruleNode = nodes.find((n) => n.label === "rule");
    assertEquals(ruleNode?.cssClass, "hl-keyword");
  });

  await t.step("renders to HTML with the role as the css class", async () => {
    const result = await highlightSource(
      "rule A = any;\n",
      CliLanguage.FullUffda,
    );
    assert(result.ok);
    const html = renderDisplayHtml(highlightResultToDisplayNodes(result));
    assertStringIncludes(html, '<span class="hl-keyword"');
    assertStringIncludes(html, ">rule<");
  });
});

Deno.test("cli.display_transform converts a match result tree to display nodes", async (t) => {
  await t.step(
    "root converts to a single tree node labeled by kind",
    async () => {
      const parsed = await patternGrammar("any");
      assert(parsed.kind === MatchKind.Ok);
      const nodes = matchResultToDisplayNodes(parsed);
      assertEquals(nodes.length, 1);
      assertEquals(nodes[0].cssClass, "match-ok");
    },
  );

  await t.step("a failed match still converts (best effort)", async () => {
    const parsed = await patternGrammar("fail");
    assert(parsed.kind === MatchKind.Ok);
    const nodes = matchResultToDisplayNodes(parsed);
    assertEquals(nodes.length, 1);
  });

  await t.step("renders nested children as nested HTML nodes", () => {
    const tree: DisplayNode[] = [{
      label: "root",
      cssClass: "match-ok",
      children: [
        { label: "child-a", cssClass: "match-ok" },
        { label: "child-b", cssClass: "match-fail" },
      ],
    }];
    const html = renderDisplayHtml(tree);
    assertStringIncludes(html, '<div class="node match-ok">');
    assertStringIncludes(html, '<span class="match-ok">child-a</span>');
    assertStringIncludes(html, '<span class="match-fail">child-b</span>');
  });

  await t.step("escapes HTML-significant characters in labels", () => {
    const html = renderDisplayHtml([{
      label: '<script>&"</script>',
      cssClass: "hl-string",
    }]);
    assertStringIncludes(html, "&lt;script&gt;&amp;&quot;&lt;/script&gt;");
    assert(!html.includes("<script>"));
  });
});
