import { assert, assertEquals } from "@std/assert";
import { compileUffdaSyntaxModule } from "../../lang/uffda/execute.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { isClean, isSuccess, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";

const paragraph = (text: string) => ({
  kind: "paragraph" as const,
  inlines: [{ kind: "text" as const, text }],
});

const commented = [
  "# head",
  'import "./a.uff" A;',
  "# among imports",
  'import "./b.uff" B;',
  "# between groups",
  "export Main; # after a declaration",
  "# before rule",
  'rule Main = "#" -> 1;',
  "# tail",
].join("\n");

const uncommented = [
  'import "./a.uff" A;',
  'import "./b.uff" B;',
  "export Main;",
  'rule Main = "#" -> 1;',
].join("\n");

Deno.test(
  "req:uffda-language-syntax-013 - comments between declarations stay in the syntax tree in order",
  async () => {
    const match = await uffdaGrammar(commented);
    assert(isClean(match));
    assert(isSuccess(match));
    const kinds = valueOf(match).declarations.map((d) =>
      d.kind === "comment" ? d.blocks : d.kind
    );
    assertEquals(kinds, [
      [paragraph("head")],
      "import",
      [paragraph("among imports")],
      "import",
      [paragraph("between groups")],
      "export",
      [paragraph("after a declaration before rule")],
      "rule",
      [paragraph("tail")],
    ]);
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - a comment-only module parses to one comment block",
  async () => {
    const match = await uffdaGrammar("# one\n# two");
    assert(isClean(match));
    assert(isSuccess(match));
    assertEquals(unwrap(valueOf(match).declarations), [
      { kind: "comment", blocks: [paragraph("one two")] },
    ]);
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - a uffda fence is parsed as a Uffda module",
  async () => {
    const match = await uffdaGrammar("# ```uffda\n# rule B = b;\n# ```");
    assert(isClean(match));
    assert(isSuccess(match));
    const [comment] = valueOf(match).declarations;
    assert(comment.kind === "comment");
    const [fence] = comment.blocks;
    assert(fence.kind === "fence");
    assertEquals(fence.language, "uffda");
    assertEquals(fence.code, "rule B = b;");
    assertEquals(
      (unwrap(fence.tree) as { declarations: { name: string }[] })
        .declarations.map((d) => d.name),
      ["B"],
    );
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - a text fence stays raw",
  async () => {
    const match = await uffdaGrammar("# ```text\n#   raw\n# ```");
    assert(isClean(match));
    assert(isSuccess(match));
    assertEquals(unwrap(valueOf(match).declarations), [
      {
        kind: "comment",
        blocks: [{ kind: "fence", language: "text", code: "  raw" }],
      },
    ]);
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - a broken uffda fence is a syntax error",
  async () => {
    const match = await uffdaGrammar("# ```uffda\n# rule B = ;\n# ```");
    assertEquals(isClean(match), false);
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - other fence tags are syntax errors",
  async () => {
    const match = await uffdaGrammar("# ```foo\n# x\n# ```");
    assertEquals(isClean(match), false);
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - a comment inside a declaration fails to parse",
  async () => {
    const match = await uffdaGrammar('rule Main = "a" # inside\n "b";');
    assertEquals(isClean(match), false);
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - a quoted # is string content",
  async () => {
    const match = await uffdaGrammar('rule Main = "# not a comment";');
    assert(isClean(match));
    assert(isSuccess(match));
    const declarations = valueOf(match).declarations;
    assertEquals(declarations.length, 1);
    assertEquals(declarations[0].kind, "rule");
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - compiling drops comments",
  async () => {
    const withComments = await uffdaGrammar(commented);
    const withoutComments = await uffdaGrammar(uncommented);
    assert(isSuccess(withComments));
    assert(isSuccess(withoutComments));
    assertEquals(
      unwrap(await compileUffdaSyntaxModule(valueOf(withComments))),
      unwrap(await compileUffdaSyntaxModule(valueOf(withoutComments))),
    );
  },
);
