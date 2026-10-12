import { assertEquals, assertThrows } from "@std/assert";
import { jsonText, stringText } from "./conversion.ts";
import { rootOrigin, Wrapped } from "../wrapped.ts";

Deno.test("req:runtime-core-012 - callable conversion rejects direct and nested values", () => {
  const callable = () => 1;
  for (const value of [callable, [callable], [[callable]]]) {
    assertThrows(
      () => stringText(value),
      TypeError,
    );
    assertThrows(() => jsonText(value), TypeError, "Cannot convert a callable");
  }
  assertThrows(() => jsonText({ callable }), TypeError);
  assertThrows(() => jsonText(new Wrapped(callable, rootOrigin(0))), TypeError);
  assertThrows(() => jsonText({ toJSON: () => callable }), TypeError);
  let invoked = false;
  const hooked = Object.assign(() => 1, {
    toJSON: () => {
      invoked = true;
      return "hidden";
    },
  });
  assertThrows(() => jsonText([hooked]), TypeError);
  assertEquals(invoked, false);
  assertEquals(jsonText({ toJSON: () => ({ answer: 42 }) }), '{"answer":42}');
  assertEquals(jsonText([undefined]), "[null]");
  assertEquals(jsonText(undefined), undefined);
  assertEquals(jsonText({ a: [1, null, "a"] }), '{"a":[1,null,"a"]}');
  for (
    const value of [
      {},
      [],
      new Map(),
      new Set(),
      new URL("https://example.com"),
    ]
  ) {
    assertThrows(() => stringText(value), TypeError);
  }
  for (const value of [42, true, null, undefined, 1n, "a"]) {
    assertEquals(stringText(value), String(value));
  }
});
