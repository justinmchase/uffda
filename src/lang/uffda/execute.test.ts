import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { executeUffdaSource } from "./execute.ts";

Deno.test("lang.uffda.execute parses compiles and runs canonical any rule", async () => {
  const m = await executeUffdaSource("rule Main any;", { input: "z" });

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(m.value, "z");
  }
});

Deno.test("lang.uffda.execute parses compiles and runs canonical projection rule", async () => {
  const m = await executeUffdaSource("rule One any -> 1;", { input: "z" });

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(m.value, 1);
  }
});
