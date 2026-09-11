import { assertEquals } from "@std/assert";
import { assertRejects } from "@std/assert/rejects";
import { collect } from "./collect.ts";

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
