import { assertEquals, assertThrows } from "@std/assert";
import { int } from "./int.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("req:runtime-core-012 - int does not implicitly format composite values", () => {
  for (const value of [{}, ["42"], () => 42]) {
    assertThrows(() => int(value), TypeError);
  }
});

Deno.test("std.int parses digit strings as base-10 integers", () => {
  assertEquals(int("42"), 42);
  assertEquals(int(["1", "2", "3"].join("")), 123);
});

Deno.test("globals.int carries metadata", () => {
  assertEquals(
    metadataOf(int)?.parameters.map((p) => p.name),
    ["value"],
  );
});

Deno.test("globals.int observes the raw value", () => {
  assertEquals(int(new Wrapped("42", rootOrigin(0, 2))), 42);
});
