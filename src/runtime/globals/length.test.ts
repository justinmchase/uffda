import { assertEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { length } from "./length.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.length returns the length of a string", () => {
  assertEquals(length("abc"), 3);
  assertEquals(length(""), 0);
});

Deno.test("globals.length returns the length of an array", () => {
  assertEquals(length([1, 2, 3]), 3);
  assertEquals(length([]), 0);
});

Deno.test("globals.length returns the size of a Set", () => {
  assertEquals(length(new Set([1, 2, 3])), 3);
});

Deno.test("globals.length returns the size of a Map", () => {
  assertEquals(length(new Map([["a", 1], ["b", 2]])), 2);
});

Deno.test("globals.length throws for unsupported values", () => {
  assertThrows(() => length(42), TypeError);
  assertThrows(() => length(null), TypeError);
  assertThrows(() => length({}), TypeError);
});

Deno.test("globals.length carries metadata", () => {
  assertEquals(
    metadataOf(length)?.parameters.map((p) => p.name),
    ["value"],
  );
});

Deno.test("globals.length observes the raw value", () => {
  assertEquals(length(new Wrapped("abc", rootOrigin(0, 3))), 3);
  assertEquals(
    length(new Wrapped([new Wrapped(1, rootOrigin(0))], rootOrigin(0))),
    1,
  );
});
