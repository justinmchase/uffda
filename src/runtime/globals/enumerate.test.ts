import { assertEquals } from "@std/assert";
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
