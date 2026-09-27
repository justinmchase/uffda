import { assertEquals } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { format } from "./format.ts";

Deno.test("globals.format substitutes positional placeholders", () => {
  assertEquals(format("{0}-{1}-{2}", "a", 1), "a-1-{2}");
});

Deno.test("globals.format carries metadata", () => {
  assertEquals(
    metadataOf(format)?.parameters.map((p) => p.name),
    ["value", "args"],
  );
});
