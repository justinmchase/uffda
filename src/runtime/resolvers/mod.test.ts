import { assertEquals } from "@std/assert";
import * as resolvers from "./mod.ts";

Deno.test("req:modules-runtime-001 - resolver exports contain data loaders, not executable import resolvers", () => {
  assertEquals("ImportResolver" in resolvers, false);
  assertEquals("JsonResolver" in resolvers, true);
  assertEquals("UffArtifactResolver" in resolvers, true);
});
