import { assertEquals } from "@std/assert";
import { assertRejects } from "@std/assert/rejects";
import { enumerate } from "./enumerate.ts";

Deno.test("globals.enumerate pairs each array element with its index", async () => {
  assertEquals(await enumerate(["a", "b", "c"]), [
    { index: 0, value: "a" },
    { index: 1, value: "b" },
    { index: 2, value: "c" },
  ]);
});

Deno.test("globals.enumerate works over strings as array-likes", async () => {
  assertEquals(await enumerate("ab"), [
    { index: 0, value: "a" },
    { index: 1, value: "b" },
  ]);
});

Deno.test("globals.enumerate returns an empty array for empty input", async () => {
  assertEquals(await enumerate([]), []);
  assertEquals(await enumerate(""), []);
});

Deno.test("globals.enumerate keeps an astral character as one entry, not two", async () => {
  // U+1F600 GRINNING FACE is a surrogate pair (2 UTF-16 code units) but one
  // Unicode code point; enumerate must not split it.
  const emoji = "\u{1F600}";
  assertEquals(emoji.length, 2); // sanity: 2 UTF-16 code units
  assertEquals(await enumerate(`a${emoji}b`), [
    { index: 0, value: "a" },
    { index: 1, value: emoji },
    { index: 2, value: "b" },
  ]);
});

Deno.test("globals.enumerate wraps plain objects via Object.entries", async () => {
  assertEquals(await enumerate({ a: 1, b: 2 }), [
    { index: "a", value: 1 },
    { index: "b", value: 2 },
  ]);
});

Deno.test("globals.enumerate supports async iterables", async () => {
  const asyncIterable: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      yield "x";
      yield "y";
    },
  };
  assertEquals(await enumerate(asyncIterable), [
    { index: 0, value: "x" },
    { index: 1, value: "y" },
  ]);
});

Deno.test("globals.enumerate rejects unsupported values", async () => {
  await assertRejects(() => enumerate(42), TypeError);
  await assertRejects(() => enumerate(null), TypeError);
});
