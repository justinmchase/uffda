import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { uffdaGrammar } from "./uffda.lang.ts";

Deno.test("lang.uffda.export-rules parses direct export names", async () => {
  const match = await uffdaGrammar("export Main Other; rule Main = any;");

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(match.value.declarations, [
      { kind: "export", name: "Main" },
      { kind: "export", name: "Other" },
      {
        kind: "rule",
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        projection: undefined,
      },
    ]);
  }
});

Deno.test("lang.uffda.export-rules requires at least one name", async () => {
  const match = await uffdaGrammar("export;");

  assertEquals(match.kind, MatchKind.Fail);
});

Deno.test("lang.uffda.export-rules rejects exports after rules", async () => {
  const match = await uffdaGrammar("rule Main = any; export Main;");

  assertEquals(match.kind, MatchKind.Fail);
});

Deno.test("lang.uffda.export-rules normalizes inline exported rules", async () => {
  const inline = await uffdaGrammar("export rule Main = any -> 1;");
  const split = await uffdaGrammar("export Main; rule Main = any -> 1;");

  assertEquals(inline.kind, MatchKind.Ok);
  assertEquals(split.kind, MatchKind.Ok);
  if (inline.kind === MatchKind.Ok && split.kind === MatchKind.Ok) {
    assertEquals(inline.value, split.value);
  }
});
