import { assertEquals } from "@std/assert";
import { isClean, MatchKind, valueOf } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { uffdaGrammar } from "./uffda.lang.ts";
import { unwrap } from "../../wrapped.ts";

Deno.test("lang.uffda.export-rules parses direct export names", async () => {
  const match = await uffdaGrammar("export Main Other; rule Main = any;");

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(valueOf(match).declarations, [
      { kind: "export", name: "Main" },
      { kind: "export", name: "Other" },
      {
        kind: "rule",
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        projection: undefined,
        attributes: [],
      },
    ]);
  }
});

Deno.test("lang.uffda.export-rules requires at least one name", async () => {
  const match = await uffdaGrammar("export;");

  assertEquals(isClean(match), false);
});

Deno.test("lang.uffda.export-rules rejects exports after rules", async () => {
  const match = await uffdaGrammar("rule Main = any; export Main;");

  assertEquals(isClean(match), false);
});

Deno.test("lang.uffda.export-rules normalizes inline exported rules", async () => {
  const inline = await uffdaGrammar("export rule Main = any -> 1;");
  const split = await uffdaGrammar("export Main; rule Main = any -> 1;");

  assertEquals(inline.kind, MatchKind.Ok);
  assertEquals(split.kind, MatchKind.Ok);
  if (inline.kind === MatchKind.Ok && split.kind === MatchKind.Ok) {
    assertEquals(unwrap(inline.value), unwrap(split.value));
  }
});

Deno.test(
  "lang.uffda.export-rules normalizes inline exported decorators",
  async () => {
    const inline = await uffdaGrammar('export decorator Example = "example";');
    const split = await uffdaGrammar(
      'export Example; decorator Example = "example";',
    );

    assertEquals(inline.kind, MatchKind.Ok);
    assertEquals(split.kind, MatchKind.Ok);
    if (inline.kind === MatchKind.Ok && split.kind === MatchKind.Ok) {
      assertEquals(unwrap(inline.value), unwrap(split.value));
    }
  },
);
