import { assertEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { enumerate } from "./enumerate.ts";

Deno.test("globals.enumerate pairs each array element with its index", () => {
  assertEquals(enumerate(["a", "b", "c"]), [
    { index: 0, value: "a" },
    { index: 1, value: "b" },
    { index: 2, value: "c" },
  ]);
});

Deno.test("globals.enumerate works over strings as array-likes", () => {
  assertEquals(enumerate("ab"), [
    { index: 0, value: "a" },
    { index: 1, value: "b" },
  ]);
});

Deno.test("globals.enumerate returns an empty array for empty input", () => {
  assertEquals(enumerate([]), []);
  assertEquals(enumerate(""), []);
});

Deno.test("globals.enumerate keeps an astral character as one entry, not two", () => {
  // U+1F600 GRINNING FACE is a surrogate pair (2 UTF-16 code units) but one
  // Unicode code point; enumerate must not split it.
  const emoji = "\u{1F600}";
  assertEquals(emoji.length, 2); // sanity: 2 UTF-16 code units
  assertEquals(enumerate(`a${emoji}b`), [
    { index: 0, value: "a" },
    { index: 1, value: emoji },
    { index: 2, value: "b" },
  ]);
});

Deno.test("globals.enumerate rejects unsupported values", () => {
  assertThrows(() => enumerate(42 as unknown as string), TypeError);
  assertThrows(() => enumerate(null as unknown as string), TypeError);
});
