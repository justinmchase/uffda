import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { expr } from "../../lang/expression/expression.lang.ts";

Deno.test("req:language-modules-negative-003 - Expression language fails deterministically on malformed source", async () => {
  const m = await expr("(add 1");
  assertEquals(m.kind, MatchKind.Fail);
});
