import { assertEquals, assertThrows } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { add } from "./add.ts";

Deno.test("globals.add adds two numbers", () => {
  assertEquals(add(2, 3), 5);
  assertThrows(() => add("2", 3));
});

Deno.test("globals.add carries metadata", () => {
  assertEquals(
    metadataOf(add)?.parameters.map((p) => p.name),
    ["left", "right"],
  );
});
