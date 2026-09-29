import { assertEquals, assertStrictEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { slice } from "./slice.ts";
import { metadataOf } from "../value_metadata.ts";
import { charOrigin, concat, rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.slice slices a string", () => {
  assertEquals(slice("hello world", 0, 5), "hello");
  assertEquals(slice("hello world", 6), "world");
  assertEquals(slice("hello world", -5), "world");
});

Deno.test("globals.slice slices an array", () => {
  assertEquals(slice([1, 2, 3, 4], 1, 3), [2, 3]);
  assertEquals(slice([1, 2, 3, 4], -2), [3, 4]);
});

Deno.test("globals.slice rejects unsupported values", () => {
  assertThrows(() => slice(42 as unknown as string, 0, 1), TypeError);
  assertThrows(() => slice(null as unknown as string, 0, 1), TypeError);
});

Deno.test("globals.slice carries metadata", () => {
  assertEquals(
    metadataOf(slice)?.parameters.map((p) => p.name),
    ["value", "start", "end"],
  );
});

Deno.test("globals.slice keeps character provenance and carries elements", () => {
  const text = concat([
    new Wrapped("a", rootOrigin(3)),
    new Wrapped("b", rootOrigin(7)),
  ], rootOrigin(0));
  const sliced = slice(text, new Wrapped(1, rootOrigin(0))) as Wrapped<string>;
  assertEquals(sliced.raw, "b");
  assertEquals(charOrigin(sliced, 0), rootOrigin(7));
  const item = new Wrapped(2, rootOrigin(1));
  assertStrictEquals(
    (slice(
      new Wrapped([new Wrapped(1, rootOrigin(0)), item], rootOrigin(0)),
      1,
    ) as unknown[])[0],
    item,
  );
});
