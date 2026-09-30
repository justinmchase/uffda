import { assertEquals } from "@std/assert";
import { isClean, MatchKind, valueOf } from "../../match.ts";
import { uffdaGrammar } from "./uffda.lang.ts";

Deno.test("lang.uffda.comment-rules parses a comment-only module", async () => {
  const match = await uffdaGrammar("# only\n#\n# comments");

  assertEquals(match.kind, MatchKind.Ok);
  assertEquals(isClean(match), true);
  if (match.kind === MatchKind.Ok) {
    assertEquals(valueOf(match).declarations, [
      { kind: "comment", text: "# only" },
      { kind: "comment", text: "#" },
      { kind: "comment", text: "# comments" },
    ]);
  }
});

Deno.test("lang.uffda.comment-rules keeps the comment text verbatim", async () => {
  const match = await uffdaGrammar('#no space, "quotes" and # hashes  ');

  assertEquals(isClean(match), true);
  if (match.kind === MatchKind.Ok) {
    assertEquals(valueOf(match).declarations, [
      { kind: "comment", text: '#no space, "quotes" and # hashes  ' },
    ]);
  }
});

Deno.test("lang.uffda.comment-rules does not treat a quoted # as a comment", async () => {
  const match = await uffdaGrammar('rule Main = "#";');

  assertEquals(isClean(match), true);
  if (match.kind === MatchKind.Ok) {
    const [declaration] = valueOf(match).declarations;
    assertEquals(declaration.kind, "rule");
  }
});
