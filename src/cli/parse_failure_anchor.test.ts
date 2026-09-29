import { assert, assertEquals } from "@std/assert";
import { anchorParseFailureLocation } from "./parse_failure_anchor.ts";
import { parseFailureLocation } from "./stream.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { MatchKind } from "../match.ts";

// Without recovery, so the module fails where discovery stopped.
async function anchored(source: string) {
  const match = await uffdaGrammar(source);
  assertEquals(match.kind, MatchKind.Fail);
  const location = await parseFailureLocation(match, source);
  assert(location);
  return anchorParseFailureLocation(match, source, location);
}

Deno.test("cli.parse_failure_anchor", async (t) => {
  await t.step(
    "anchors after the last token of an unfinished line",
    async () => {
      const line = 'import "./dep.uff"';
      const location = await anchored(`${line}\n\nexport A;\nrule A = any;`);
      assertEquals(location.line, 0);
      assertEquals(location.column, line.length);
      assertEquals(location.endOffset, line.length);
    },
  );

  await t.step("skips a trailing comment on the unfinished line", async () => {
    const line = 'import "./dep.uff" A';
    const location = await anchored(
      `${line} # names\nexport A;\nrule A = any;`,
    );
    assertEquals(location.line, 0);
    assertEquals(location.column, line.length);
  });

  await t.step(
    "keeps an unexpected token on the same line where it is",
    async () => {
      const source = 'import "./dep.uff" 123;\nexport A;';
      const location = await anchored(source);
      assertEquals(location.line, 0);
      assertEquals(source.slice(location.offset, location.endOffset), "123");
    },
  );
});
