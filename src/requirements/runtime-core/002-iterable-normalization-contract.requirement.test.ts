import { assertEquals, assertThrows } from "@std/assert";
import { Input } from "../../input.ts";

Deno.test("req:runtime-core-002 - Iterable normalization requires iterable input and preserves item order", async (t) => {
  await t.step("iterable mode reads iterable items in order", () => {
    const input = Input.Iterable(["x", "y", "z"]);

    const i1 = input.next();
    const i2 = i1.next();
    const i3 = i2.next();

    assertEquals(i1.value, "x");
    assertEquals(i2.value, "y");
    assertEquals(i3.value, "z");
    assertEquals(i3.done, true);
  });

  await t.step("iterable mode rejects non-iterable values", () => {
    assertThrows(
      () => Input.Iterable(7 as unknown as Iterable<unknown>),
      TypeError,
      "Iterable normalization mode requires an iterable or iterator input value",
    );
  });
});
