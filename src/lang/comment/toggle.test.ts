import { assertEquals } from "@std/assert";
import { parseGrammar } from "../grammar.ts";
import { MatchKind, valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";

const moduleUrl = new URL("./toggle.uff", import.meta.url);

async function toggle(text: string): Promise<unknown> {
  const match = await parseGrammar<string>({
    source: text,
    moduleUrl,
    entryRuleName: "ToggleHashComment",
  });
  if (match.kind !== MatchKind.Ok) {
    throw new Error(`toggle failed: ${match.kind}`);
  }
  return unwrap(valueOf(match));
}

Deno.test("lang.comment.toggle", async (t) => {
  await t.step(
    "TOGGLE00 - lines with any uncommented line are commented",
    async () => {
      assertEquals(await toggle("rule A = a;"), "# rule A = a;");
      assertEquals(await toggle("# a\nrule A;"), "# # a\n# rule A;");
    },
  );

  await t.step(
    "TOGGLE01 - comments go at the smallest indentation of the non-blank lines",
    async () => {
      assertEquals(await toggle("  a\n\n    b"), "  # a\n\n  #   b");
      assertEquals(await toggle("\ta\n\t\tb"), "\t# a\n\t# \tb");
    },
  );

  await t.step(
    "TOGGLE02 - lines that are all comments or blank are uncommented",
    async () => {
      assertEquals(await toggle("  # a\n\n  #b\n#"), "  a\n\n  b\n");
      assertEquals(await toggle("#  a"), " a");
    },
  );

  await t.step(
    "TOGGLE03 - blank lines and line endings are kept",
    async () => {
      assertEquals(await toggle("a\r\n  \r\nb"), "# a\r\n  \r\n# b");
      assertEquals(await toggle("# a\r\n# b"), "a\r\nb");
      assertEquals(await toggle(""), "");
      assertEquals(await toggle("  \n"), "  \n");
    },
  );
});
