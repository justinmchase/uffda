import { assertEquals, assertStrictEquals } from "@std/assert";
import { last } from "./last.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.last returns the final array element", () => {
  assertEquals(last(["a", "b", "c"], null), "c");
});

Deno.test("globals.last returns the fallback for an empty array", () => {
  assertEquals(last([], "fallback"), "fallback");
});

Deno.test("globals.last works over strings as array-likes", () => {
  assertEquals(last("ab", null), "b");
  assertEquals(last("", "fallback"), "fallback");
});

Deno.test("globals.last carries metadata", () => {
  assertEquals(
    metadataOf(last)?.parameters.map((p) => p.name),
    ["self", "fallback"],
  );
});

Deno.test("globals.last carries the wrapped element", () => {
  const item = new Wrapped(2, rootOrigin(1));
  assertStrictEquals(
    last(
      new Wrapped([new Wrapped(1, rootOrigin(0)), item], rootOrigin(0, 2)),
      undefined,
    ),
    item,
  );
});
