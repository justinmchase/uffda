import { assertEquals } from "@std/assert";
import { collect } from "../collect.ts";
import { enumerate } from "./enumerate.ts";

Deno.test("globals.enumerate pairs each array element with its index", async () => {
  assertEquals(await collect(enumerate(["a", "b", "c"])), [
    { index: 0, value: "a" },
    { index: 1, value: "b" },
    { index: 2, value: "c" },
  ]);
});

Deno.test("globals.enumerate works over strings as array-likes", async () => {
  assertEquals(await collect(enumerate("ab")), [
    { index: 0, value: "a" },
    { index: 1, value: "b" },
  ]);
});

Deno.test("globals.enumerate returns an empty array for empty input", async () => {
  assertEquals(await collect(enumerate([])), []);
  assertEquals(await collect(enumerate("")), []);
});

Deno.test("globals.enumerate keeps an astral character as one entry, not two", async () => {
  // U+1F600 GRINNING FACE is a surrogate pair (2 UTF-16 code units) but one
  // Unicode code point; enumerate must not split it.
  const emoji = "\u{1F600}";
  assertEquals(emoji.length, 2); // sanity: 2 UTF-16 code units
  assertEquals(await collect(enumerate(`a${emoji}b`)), [
    { index: 0, value: "a" },
    { index: 1, value: emoji },
    { index: 2, value: "b" },
  ]);
});

Deno.test("globals.enumerate wraps plain objects via Object.entries", async () => {
  assertEquals(await collect(enumerate({ a: 1, b: 2 })), [
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
  assertEquals(await collect(enumerate(asyncIterable)), [
    { index: 0, value: "x" },
    { index: 1, value: "y" },
  ]);
});

Deno.test("globals.enumerate treats unsupported values as a one-item enumeration of themselves", async () => {
  assertEquals(await collect(enumerate(42)), [{ index: 0, value: 42 }]);
  assertEquals(await collect(enumerate(null)), [{ index: 0, value: null }]);
});

Deno.test("globals.enumerate is lazy: nothing runs until drained", async () => {
  let touched = false;
  const source: Iterable<string> = {
    [Symbol.iterator]() {
      touched = true;
      return ["a"][Symbol.iterator]();
    },
  };
  const gen = enumerate(source);
  assertEquals(touched, false);
  assertEquals(await collect(gen), [{ index: 0, value: "a" }]);
  assertEquals(touched, true);
});
