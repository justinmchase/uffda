import { assert, assertEquals } from "@std/assert";
import { isClean, isSuccess, type Match, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";
import { formatUffdaSource } from "../uffda/format.ts";

const formats = async (source: string, expected: string[]) => {
  const match = (await formatUffdaSource(source)) as Match<unknown>;
  assert(
    isClean(match) && isSuccess(match),
    `expected ${JSON.stringify(source)} to format`,
  );
  assertEquals(
    unwrap(valueOf(match)),
    [...expected, ""].join("\n"),
  );
};

const words = (count: number) =>
  Array.from({ length: count }, (_, i) => `word${i}`).join(" ");

Deno.test("lang.comment.format", async (t) => {
  await t.step(
    "COMMENT_FORMAT00 - an empty comment is `#`",
    () => formats("#", ["#"]),
  );

  await t.step(
    "COMMENT_FORMAT01 - paragraphs are rewrapped to the line width",
    () =>
      formats(`# ${words(20)}`, [
        "# word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11",
        "# word12 word13 word14 word15 word16 word17 word18 word19",
      ]),
  );

  await t.step(
    "COMMENT_FORMAT02 - blocks are separated by one `#` line",
    () => formats("# one\n#\n#\n# two", ["# one", "#", "# two"]),
  );

  await t.step(
    "COMMENT_FORMAT03 - list items wrap with an indented continuation",
    () =>
      formats(`# - ${words(20)}\n# - short`, [
        "# - word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11",
        "#   word12 word13 word14 word15 word16 word17 word18 word19",
        "# - short",
      ]),
  );

  await t.step(
    "COMMENT_FORMAT04 - inline code is never split and `-` never starts a line",
    async () => {
      await formats(
        "# aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa `b c d`",
        [
          "# aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "# `b c d`",
        ],
      );
      await formats(
        "# aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa - b",
        [
          "# aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -",
          "# b",
        ],
      );
    },
  );

  await t.step(
    "COMMENT_FORMAT05 - fenced text is kept and a uffda fence is formatted",
    () =>
      formats(
        "# ```text\n#   kept   as is\n# ```\n#\n# ```uffda\n# rule   A =\n#   ok;\n# ```",
        [
          "# ```text",
          "#   kept   as is",
          "# ```",
          "#",
          "# ```uffda",
          "# rule A = ok;",
          "# ```",
        ],
      ),
  );
});
