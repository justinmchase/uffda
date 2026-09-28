import { assertEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { base58 } from "./base58.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.base58 encodes bytes", () => {
  const bytes = new TextEncoder().encode("Hello World!");
  assertEquals(base58(bytes), "2NEpo7TZRRrLZSi2U");
});

Deno.test("globals.base58 rejects non-bytes", () => {
  assertThrows(() => base58("abc" as unknown as Uint8Array), TypeError);
  assertThrows(() => base58([1, 2, 3] as unknown as Uint8Array), TypeError);
});

Deno.test("globals.base58 carries metadata", () => {
  assertEquals(
    metadataOf(base58)?.parameters.map((p) => p.name),
    ["bytes"],
  );
});

Deno.test("globals.base58 observes the raw bytes", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  assertEquals(base58(new Wrapped(bytes, rootOrigin(0))), base58(bytes));
});
