import { assert, assertEquals } from "@std/assert";
import { uffdaGrammar } from "../uffda/uffda.lang.ts";
import { isClean, isSuccess, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";
import type {
  CommentBlock,
  CommentInline,
  CommentParagraph,
} from "./comment.types.ts";

const text = (text: string): CommentInline => ({ kind: "text", text });
const code = (text: string): CommentInline => ({ kind: "code", text });
const paragraph = (...inlines: CommentInline[]): CommentParagraph => ({
  kind: "paragraph",
  inlines,
});

const blocks = async (source: string): Promise<CommentBlock[]> => {
  const match = await uffdaGrammar(source);
  assert(isClean(match), `expected a clean parse of ${JSON.stringify(source)}`);
  assert(isSuccess(match));
  const declarations = unwrap(valueOf(match).declarations) as {
    kind: string;
    blocks: CommentBlock[];
  }[];
  assertEquals(declarations.length, 1);
  assertEquals(declarations[0].kind, "comment");
  return declarations[0].blocks;
};

const fails = async (source: string) => {
  const match = await uffdaGrammar(source);
  assertEquals(
    isClean(match),
    false,
    `expected ${JSON.stringify(source)} to fail`,
  );
};

Deno.test("lang.comment", async (t) => {
  await t.step("COMMENT_MARKER_AND_ONE_SPACE_ARE_DROPPED", async () => {
    assertEquals(await blocks("#hello\n#  world"), [
      paragraph(text("hello world")),
    ]);
  });

  await t.step("COMMENT_EMPTY_BLOCK", async () => {
    assertEquals(await blocks("#\n#"), []);
  });

  await t.step("COMMENT_WHITESPACE_COLLAPSES", async () => {
    assertEquals(await blocks("#   a   b\tc  "), [paragraph(text("a b c"))]);
  });

  await t.step("COMMENT_BLANK_LINES_SEPARATE_PARAGRAPHS", async () => {
    assertEquals(await blocks("# one\n#\n#\n# two"), [
      paragraph(text("one")),
      paragraph(text("two")),
    ]);
  });

  await t.step("COMMENT_INLINE_CODE", async () => {
    assertEquals(await blocks("# use `a  b` here"), [
      paragraph(text("use "), code("a  b"), text(" here")),
    ]);
  });

  await t.step("COMMENT_INLINE_CODE_SPANS_LINES", async () => {
    assertEquals(await blocks("# a `long\n# code` b"), [
      paragraph(text("a "), code("long code"), text(" b")),
    ]);
  });

  await t.step("COMMENT_LIST_ITEMS", async () => {
    assertEquals(await blocks("# intro\n# - one\n#   more\n#   - two `x`"), [
      paragraph(text("intro")),
      {
        kind: "list",
        items: [
          { inlines: [text("one more")] },
          { inlines: [text("two "), code("x")] },
        ],
      },
    ]);
  });

  await t.step("COMMENT_DASH_WITHOUT_SPACE_IS_TEXT", async () => {
    assertEquals(await blocks("# -one"), [paragraph(text("-one"))]);
  });

  await t.step("COMMENT_UNTAGGED_FENCE_IS_RAW", async () => {
    assertEquals(await blocks("# ```\n#   a  `\n# b\n# ```"), [
      { kind: "fence", language: "", code: "  a  `\nb" },
    ]);
  });

  await t.step("COMMENT_TEXT_FENCE_IS_RAW", async () => {
    assertEquals(await blocks("# text\n#  ```text  \n# a\n#   ```  "), [
      paragraph(text("text")),
      { kind: "fence", language: "text", code: "a" },
    ]);
  });

  await t.step("COMMENT_UFFDA_FENCE_IS_PARSED", async () => {
    const [fence] = await blocks("# ```uffda\n# rule B = b;\n# ```");
    assert(fence.kind === "fence");
    assertEquals(fence.language, "uffda");
    assertEquals(fence.code, "rule B = b;");
    assertEquals(
      (fence.tree as { declarations: { name: string }[] }).declarations.map((
        d,
      ) => d.name),
      ["B"],
    );
  });

  await t.step("COMMENT_UNCLOSED_INLINE_CODE_FAILS", async () => {
    await fails("# open `code");
  });

  await t.step("COMMENT_EMPTY_INLINE_CODE_FAILS", async () => {
    await fails("# a `` b");
  });

  await t.step("COMMENT_UNCLOSED_FENCE_FAILS", async () => {
    await fails("# ```\n# unclosed");
  });

  await t.step("COMMENT_UNKNOWN_FENCE_TAG_FAILS", async () => {
    await fails("# ```foo\n# x\n# ```");
  });

  await t.step("COMMENT_BROKEN_UFFDA_FENCE_FAILS", async () => {
    await fails("# ```uffda\n# rule B = ;\n# ```");
  });
});
