import { assertEquals } from "@std/assert";
import { reduce } from "./reduce.ts";

Deno.test("globals.reduce folds into a scalar accumulator", async () => {
  const result = await reduce(
    [1, 2, 3, 4],
    0,
    (acc, item) => (acc as number) + (item as number),
  );
  assertEquals(result, 10);
});

Deno.test("globals.reduce scans into a growing array accumulator", async () => {
  const result = await reduce(
    [1, 2, 3],
    [] as number[],
    (acc, item) => [...(acc as number[]), (item as number) * 2],
  );
  assertEquals(result, [2, 4, 6]);
});

Deno.test("globals.reduce awaits async callbacks", async () => {
  const result = await reduce(
    [1, 2, 3],
    0,
    (acc, item) => Promise.resolve((acc as number) + (item as number)),
  );
  assertEquals(result, 6);
});

Deno.test("globals.reduce works over strings as array-likes", async () => {
  const result = await reduce(
    "abc",
    "",
    (acc, item) => `${acc}${item}${item}`,
  );
  assertEquals(result, "aabbcc");
});

Deno.test("globals.reduce returns the initial value for empty input", async () => {
  assertEquals(await reduce([], 42, (acc) => acc), 42);
});
