import { assertEquals } from "@std/assert";
import { collect } from "./testing.ts";

Deno.test("testing.collect", async (t) => {
  await t.step("drains an async iterable into an array", async () => {
    const source = async function* () {
      yield "a";
      yield "b";
      yield "c";
    };
    assertEquals(await collect(source()), ["a", "b", "c"]);
  });

  await t.step(
    "returns an empty array for an empty async iterable",
    async () => {
      const source = async function* () {};
      assertEquals(await collect(source()), []);
    },
  );
});
