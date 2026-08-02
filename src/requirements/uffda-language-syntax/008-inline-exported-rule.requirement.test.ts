import { assertEquals } from "@std/assert";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { MatchKind } from "../../match.ts";

Deno.test("req:uffda-language-syntax-008 - inline exported rules normalize to split declarations", async () => {
  const inline = await uffdaGrammar("export rule Main = any -> 1;");
  const split = await uffdaGrammar("export Main; rule Main = any -> 1;");

  assertEquals(inline.kind, MatchKind.Ok);
  assertEquals(split.kind, MatchKind.Ok);
  if (inline.kind === MatchKind.Ok && split.kind === MatchKind.Ok) {
    assertEquals(inline.value, split.value);
  }
});
