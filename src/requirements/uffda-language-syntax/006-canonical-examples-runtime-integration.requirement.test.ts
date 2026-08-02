import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { executeUffdaSource } from "../../lang/uffda/uffda.lang.ts";

Deno.test("req:uffda-language-syntax-006 - Canonical Uffda examples parse compile and execute", async (t) => {
  await t.step("identity canonical example executes end-to-end", async () => {
    const m = await executeUffdaSource("export Main; rule Main = any;", {
      entryRuleName: "Main",
      input: "z",
    });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, "z");
    }
  });

  await t.step("projection canonical example executes end-to-end", async () => {
    const m = await executeUffdaSource("export One; rule One = any -> 1;", {
      entryRuleName: "One",
      input: "z",
    });
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, 1);
    }
  });
});
