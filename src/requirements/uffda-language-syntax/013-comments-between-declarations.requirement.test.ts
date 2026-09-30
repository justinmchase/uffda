import { assert, assertEquals } from "@std/assert";
import { compileUffdaSyntaxModule } from "../../lang/uffda/execute.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { isClean, isSuccess, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";

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
      d.kind === "comment" ? d.text : d.kind
    );
    assertEquals(kinds, [
      "# head",
      "import",
      "# among imports",
      "import",
      "# between groups",
      "export",
      "# after a declaration",
      "# before rule",
      "rule",
      "# tail",
    ]);
  },
);

Deno.test(
  "req:uffda-language-syntax-013 - a comment-only module parses to its comments",
  async () => {
    const match = await uffdaGrammar("# one\n# two");
    assert(isClean(match));
    assert(isSuccess(match));
    assertEquals(valueOf(match).declarations, [
      { kind: "comment", text: "# one" },
      { kind: "comment", text: "# two" },
    ]);
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
