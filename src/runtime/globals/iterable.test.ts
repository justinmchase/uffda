import { assertEquals, assertStrictEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { iterable } from "./iterable.ts";

async function collect(value: AsyncIterable<unknown>): Promise<unknown[]> {
  const items: unknown[] = [];
  for await (const item of value) {
    items.push(item);
  }
  return items;
}

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
