import { assertEquals, assertStrictEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { iterable } from "./iterable.ts";
import { collect } from "../../testing.ts";
import { metadataOf } from "../value_metadata.ts";
import { concat, isWrapped, rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.iterable wraps a sync iterable string as async", async () => {
  const result = await collect(iterable("abc"));
  assertEquals(result, ["a", "b", "c"]);
});

Deno.test("globals.iterable wraps a sync iterable array as async", async () => {
  const result = await collect(iterable([1, 2, 3]));
  assertEquals(result, [1, 2, 3]);
});

Deno.test("globals.iterable returns an already-async iterable unchanged", async () => {
  const source: AsyncIterable<unknown> = {
    async *[Symbol.asyncIterator]() {
      yield "x";
      yield "y";
    },
  };
  assertStrictEquals(iterable(source), source);
  assertEquals(await collect(iterable(source)), ["x", "y"]);
});

Deno.test("globals.iterable rejects values without Symbol.iterator or Symbol.asyncIterator", () => {
  assertThrows(() => iterable(7), TypeError);
  assertThrows(() => iterable(null), TypeError);
  assertThrows(() => iterable({}), TypeError);
});

Deno.test("globals.iterable carries metadata", () => {
  assertEquals(
    metadataOf(iterable)?.parameters.map((p) => p.name),
    ["value"],
  );
});

Deno.test("globals.iterable yields wrapped items of a wrapped value", async () => {
  const text = concat([
    new Wrapped("a", rootOrigin(3)),
    new Wrapped("b", rootOrigin(7)),
  ], rootOrigin(0));
  const source = iterable(text);
  assertEquals(Object.hasOwn(source, Symbol.asyncIterator), true);
  const items = await Array.fromAsync(source);
  assertEquals(items.every(isWrapped), true);
  assertEquals(items.map((item) => (item as Wrapped).origin), [
    rootOrigin(3),
    rootOrigin(7),
  ]);
  assertEquals((await Array.fromAsync(source)).length, 2);
});
