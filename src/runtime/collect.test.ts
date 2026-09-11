import { assertEquals } from "@std/assert";
import { assertRejects } from "@std/assert/rejects";
import { collect, isGenerator } from "./collect.ts";

Deno.test("runtime.collect drains an array unchanged", async () => {
  assertEquals(await collect([1, 2, 3]), [1, 2, 3]);
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

Deno.test("runtime.collect rejects values with no iterator protocol", async () => {
  await assertRejects(() => collect(42), TypeError);
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
