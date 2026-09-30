import { assert, assertEquals } from "@std/assert";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { isClean, isSuccess, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";

const source = [
  "#   First   line",
  "#second `code",
  "# spans` lines",
  "#",
  "# - one",
  "#   more",
  "#   - two",
  "# ```text",
  "#   kept  ",
  "#",
  "#  x",
  "# ```",
  "#",
  "# ```uffda",
  "# rule B = b;",
  "#   ```  ",
].join("\n");

Deno.test(
  "req:comment-syntax-001 - a comment block parses into paragraphs, lists, and fences in order",
  async () => {
    const match = await uffdaGrammar(source);
    assert(isClean(match));
    assert(isSuccess(match));
    const [comment] = unwrap(valueOf(match).declarations) as {
      kind: string;
      blocks: Record<string, unknown>[];
    }[];
    assertEquals(comment.kind, "comment");
    const [paragraph, list, text, uffda] = comment.blocks;
    assertEquals(comment.blocks.length, 4);
    assertEquals(paragraph, {
      kind: "paragraph",
      inlines: [
        { kind: "text", text: "First line second " },
        { kind: "code", text: "code spans" },
        { kind: "text", text: " lines" },
      ],
    });
    assertEquals(list, {
      kind: "list",
      items: [
        { inlines: [{ kind: "text", text: "one more" }] },
        { inlines: [{ kind: "text", text: "two" }] },
      ],
    });
    assertEquals(text, {
      kind: "fence",
      language: "text",
      code: "  kept  \n\n x",
    });
    const { tree, ...fence } = uffda;
    assertEquals(fence, {
      kind: "fence",
      language: "uffda",
      code: "rule B = b;",
    });
    assertEquals((tree as { kind: string }).kind, "module");
  },
);

Deno.test(
  "req:comment-syntax-001 - malformed comments are syntax errors",
  async (t) => {
    for (
      const [name, bad] of [
        ["an unclosed fence", "# ```\n# x"],
        ["an unclosed inline code span", "# a `b"],
        ["a rejected fence tag", "# ```foo\n# x\n# ```"],
        ["fenced code that does not parse", "# ```uffda\n# rule = ;\n# ```"],
      ]
    ) {
      await t.step(name, async () => {
        assertEquals(isClean(await uffdaGrammar(bad)), false);
      });
    }
  },
);
