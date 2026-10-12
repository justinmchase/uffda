import { assertEquals, assertThrows } from "@std/assert";
import { uffdaOutput } from "./value_output.ts";

Deno.test("req:cli-exec-002 - Uffda display is explicit and does not invoke conversion hooks", () => {
  assertEquals(uffdaOutput([1, 2]), "[1 2]\n");
  assertEquals(uffdaOutput({ a: [1, "a{b"] }), '{["a"]: [1 "a\\{b"]}\n');
  assertEquals(uffdaOutput("hello"), "hello\n");
  assertEquals(
    uffdaOutput([null, undefined, false, -2]),
    "[null undefined false (sub 0 2)]\n",
  );
  const shared = [1];
  assertEquals(uffdaOutput([shared, shared]), "[[1] [1]]\n");
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  assertThrows(() => uffdaOutput(cyclic), TypeError);
  for (
    const value of [
      () => 1,
      [() => 1],
      { f: () => 1 },
      new Set(),
      0.5,
      -0,
      Infinity,
    ]
  ) {
    assertThrows(() => uffdaOutput(value), TypeError);
  }
  let called = false;
  assertThrows(() =>
    uffdaOutput({
      toJSON: () => {
        called = true;
        return "hidden";
      },
    }), TypeError);
  assertEquals(called, false);
});
