import { assertEquals } from "@std/assert";
import { filter } from "./filter.ts";

Deno.test("globals.filter keeps elements whose async predicate is truthy", async () => {
  const result = await filter(
    [1, 2, 3, 4],
    (v) => Promise.resolve((v as number) % 2 === 0),
  );
  assertEquals(result, [2, 4]);
});

Deno.test("globals.filter works over strings as array-likes", async () => {
  const result = await filter("a\nb\n", (v) => v === "\n");
  assertEquals(result, ["\n", "\n"]);
});

Deno.test("globals.filter returns an empty array when nothing matches", async () => {
  assertEquals(await filter([1, 2], () => false), []);
});
