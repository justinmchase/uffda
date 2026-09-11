import { assertEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { base58 } from "./base58.ts";

Deno.test("globals.base58 encodes bytes", () => {
  const bytes = new TextEncoder().encode("Hello World!");
  assertEquals(base58(bytes), "2NEpo7TZRRrLZSi2U");
});

Deno.test("globals.base58 rejects non-bytes", () => {
  assertThrows(() => base58("abc" as unknown as Uint8Array), TypeError);
  assertThrows(() => base58([1, 2, 3] as unknown as Uint8Array), TypeError);
});
