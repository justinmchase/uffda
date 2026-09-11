import { assertEquals } from "@std/assert";
import { assertRejects } from "@std/assert/rejects";
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

Deno.test("globals.reduce works over strings", async () => {
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

Deno.test("globals.reduce keeps an astral character as one item, not two", async () => {
  // U+1F600 GRINNING FACE is a surrogate pair (2 UTF-16 code units) but one
  // Unicode code point; reduce must not split it.
  const emoji = "\u{1F600}";
  assertEquals(emoji.length, 2); // sanity: 2 UTF-16 code units
  const items = await reduce(
    `a${emoji}b`,
    [] as string[],
    (acc, item) => [...(acc as string[]), item as string],
  );
  assertEquals(items, ["a", emoji, "b"]);
});

Deno.test("globals.reduce rejects unsupported values", async () => {
  await assertRejects(
    () => reduce(42 as unknown as string, 0, (a) => a),
    TypeError,
  );
  await assertRejects(
    () => reduce(null as unknown as string, 0, (a) => a),
    TypeError,
  );
});
