import { assert, assertEquals } from "@std/assert";
import { HighlightRole, highlightSpansFromMatch } from "./highlight.ts";
import { resolveReferenceRoles } from "./lsp.reference_roles.ts";
import { RuntimeSession } from "./mcp.session.ts";

async function rolesOf(id: string, source: string) {
  const session = new RuntimeSession(id);
  await session.load(source);
  const state = session.getLatestParseState();
  assert(state);
  const spans = resolveReferenceRoles(
    highlightSpansFromMatch(state.match, state.source),
    state.match,
    session,
  );
  /** The role of the last occurrence of `text`. */
  return (text: string) => spans.findLast((span) => span.text === text)?.role;
}

Deno.test("cli.lsp.reference_roles resolveReferenceRoles", async (t) => {
  await t.step("colors expression references by what they name", async () => {
    const role = await rolesOf(
      "roles-1",
      `export Main;
rule IsNotComment = any;
func TokenText<t:any> = t;
rule Main = tokens:any -> (map (filter tokens IsNotComment) TokenText coalesce);`,
    );
    assertEquals(role("map"), HighlightRole.Function);
    assertEquals(role("filter"), HighlightRole.Function);
    assertEquals(role("tokens"), HighlightRole.Variable);
    assertEquals(role("IsNotComment"), HighlightRole.Type);
    assertEquals(role("TokenText"), HighlightRole.Function);
    assertEquals(role("coalesce"), HighlightRole.Function);
  });

  await t.step("a local binding shadows a declaration", async () => {
    const role = await rolesOf(
      "roles-2",
      `export Main;
rule Other = any;
rule Main = Other:any -> (f Other);`,
    );
    assertEquals(role("Other"), HighlightRole.Variable);
  });

  await t.step("an unresolved name stays a variable", async () => {
    const role = await rolesOf(
      "roles-3",
      `export Main;
rule Main = any -> (f nowhere);`,
    );
    assertEquals(role("nowhere"), HighlightRole.Variable);
  });

  await t.step("leaves other roles untouched", async () => {
    const role = await rolesOf("roles-4", "rule Main = any;\nexport Main;");
    assertEquals(role("Main"), HighlightRole.Identifier);
    assertEquals(role("rule"), HighlightRole.Keyword);
  });
});
