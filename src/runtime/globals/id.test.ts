import { assertEquals } from "@std/assert";
import { id } from "./id.ts";
import { metadataOf } from "../value_metadata.ts";

Deno.test("std.id returns its input unchanged", () => {
  const input = { a: 1 };
  assertEquals(id(input), input);
});

Deno.test("globals.id carries metadata", () => {
  assertEquals(
    metadataOf(id)?.parameters.map((p) => p.name),
    ["value"],
  );
});
