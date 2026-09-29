import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { collect, isGenerator } from "./collect.ts";
import { concat, rootOrigin, Wrapped } from "../wrapped.ts";

Deno.test("runtime.collect drains an array unchanged", async () => {
  assertEquals(await collect([1, 2, 3]), [1, 2, 3]);
});

Deno.test("runtime.collect drains a sync iterable synchronously and an async iterable through a promise", async () => {
  assertEquals(collect(new Set([1, 2])), [1, 2]);
  const fromAsync = collect((async function* () {
    yield 1;
  })());
  assert(fromAsync instanceof Promise);
  assertEquals(await fromAsync, [1]);
});

Deno.test("runtime.collect drains a string into code points", async () => {
  assertEquals(await collect("ab"), ["a", "b"]);
});

Deno.test("runtime.collect drains an async generator", async () => {
  async function* gen() {
    yield 1;
    yield 2;
  }
  assertEquals(await collect(gen()), [1, 2]);
});

Deno.test("runtime.collect throws for values with no iterator protocol", () => {
  assertThrows(() => collect(42), TypeError);
});

Deno.test("runtime.isGenerator is true for sync and async generator instances", () => {
  function* gen() {
    yield 1;
  }
  async function* asyncGen() {
    yield 1;
  }
  assertEquals(isGenerator(gen()), true);
  assertEquals(isGenerator(asyncGen()), true);
});

Deno.test("runtime.isGenerator is false for plain values and non-generator iterables", () => {
  assertEquals(isGenerator(null), false);
  assertEquals(isGenerator(42), false);
  assertEquals(isGenerator("[object Generator]"), false);
  assertEquals(isGenerator([1, 2, 3]), false);
  assertEquals(
    isGenerator({ [Symbol.iterator]: () => [][Symbol.iterator]() }),
    false,
  );
});

Deno.test("runtime.isGenerator is not fooled by a spoofed Symbol.toStringTag", () => {
  const spoof = { [Symbol.toStringTag]: "Generator" };
  assertEquals(Object.prototype.toString.call(spoof), "[object Generator]");
  assertEquals(isGenerator(spoof), false);
});

Deno.test("runtime.collect wraps the items of a wrapped value", async () => {
  const item = new Wrapped(1, rootOrigin(2));
  const drained = await collect(new Wrapped([item, 2], rootOrigin(0, 3)));
  assertStrictEquals(drained[0], item);
  assertEquals((drained[1] as Wrapped).raw, 2);
  const text = concat([new Wrapped("a", rootOrigin(4)), "b"], rootOrigin(9));
  const chars = await collect(text) as Wrapped[];
  assertEquals(chars.map((c) => c.origin), [rootOrigin(4), rootOrigin(9)]);
});

Deno.test("runtime.isGenerator sees through a wrapper", () => {
  assert(isGenerator(new Wrapped((function* () {})(), rootOrigin(0))));
});
