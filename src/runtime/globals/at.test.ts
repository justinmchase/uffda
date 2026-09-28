import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { at } from "./at.ts";
import { metadataOf } from "../value_metadata.ts";
import { charOrigin, concat, rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("runtime.at indexes arrays", () => {
  assertEquals(at([1, 2, 3], 1), 2);
  assertEquals(at([1, 2, 3], 5), undefined);
});

Deno.test("runtime.at indexes strings by UTF-16 code unit", () => {
  assertEquals(at("abc", 0), "a");
  assertEquals(at("abc", 2), "c");
});

Deno.test("runtime.at indexes Sets by insertion order", () => {
  const set = new Set(["a", "b", "c"]);
  assertEquals(at(set, 0), "a");
  assertEquals(at(set, 2), "c");
  assertEquals(at(set, 5), undefined);
});

Deno.test("runtime.at indexes Maps as [key, value] entries by insertion order", () => {
  const map = new Map([["a", 1], ["b", 2]]);
  assertEquals(at(map, 0), ["a", 1]);
  assertEquals(at(map, 1), ["b", 2]);
  assertEquals(at(map, 5), undefined);
});

Deno.test("runtime.at rejects unsupported types", () => {
  assertThrows(() => at({}, 0), TypeError);
});

Deno.test("globals.at carries metadata", () => {
  assertEquals(
    metadataOf(at)?.parameters.map((p) => p.name),
    ["value", "index"],
  );
});

Deno.test("globals.at carries wrapped elements and characters", () => {
  const item = new Wrapped(2, rootOrigin(1));
  const items = new Wrapped(
    [new Wrapped(1, rootOrigin(0)), item],
    rootOrigin(0, 2),
  );
  assertStrictEquals(at(items, new Wrapped(1, rootOrigin(9))), item);
  const text = concat([
    new Wrapped("a", rootOrigin(3)),
    new Wrapped("b", rootOrigin(7)),
  ], rootOrigin(0));
  const char = at(text, 1) as Wrapped<string>;
  assertEquals(char.raw, "b");
  assertEquals(charOrigin(char, 0), rootOrigin(7));
});
