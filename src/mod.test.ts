import { assertEquals } from "@std/assert";
import * as uffda from "./mod.ts";

Deno.test("mod exports the value provenance helpers", () => {
  const exported = uffda as Record<string, unknown>;
  for (
    const name of [
      "Wrapped",
      "isWrapped",
      "wrap",
      "rawOf",
      "unwrap",
      "concat",
      "rootOrigin",
      "valueOf",
    ]
  ) {
    assertEquals(typeof exported[name], "function", name);
  }
});
