import { assertEquals } from "@std/assert";
import { map } from "./map.ts";

Deno.test("globals.map projects each element through an async callback", async () => {
  const result = await map(
    [1, 2, 3],
    (v) => Promise.resolve((v as number) * 2),
  );
  assertEquals(result, [2, 4, 6]);
});

Deno.test("globals.map works over strings as array-likes", async () => {
  const result = await map("ab", (v) => `${v}!`);
  assertEquals(result, ["a!", "b!"]);
});

Deno.test("globals.map returns an empty array for empty input", async () => {
  assertEquals(await map([], (v) => v), []);
});
