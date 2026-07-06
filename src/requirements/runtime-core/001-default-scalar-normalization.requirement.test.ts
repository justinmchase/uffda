import { assertEquals, assertThrows } from "@std/assert";
import { Input, InputNormalizationMode } from "../../input.ts";

Deno.test("req:runtime-core-001 - Runtime defaults to scalar normalization and rejects unknown normalization modes", async (t) => {
  await t.step(
    "default mode is scalar and treats iterable input as one item",
    () => {
      const input = Input.From("abc");
      const next = input.next();

      assertEquals(input.kind, InputNormalizationMode.Scalar);
      assertEquals(next.value, "abc");
      assertEquals(next.done, true);
    },
  );

  await t.step("explicit scalar mode treats iterable input as one item", () => {
    const input = Input.From([1, 2, 3], {
      kind: InputNormalizationMode.Scalar,
    });
    const next = input.next();

    assertEquals(next.value, [1, 2, 3]);
    assertEquals(next.done, true);
  });

  await t.step("unknown normalization mode throws explicit error", () => {
    assertThrows(
      () => Input.From("abc", { kind: "bogus" as InputNormalizationMode }),
      TypeError,
      "Unknown input normalization mode",
    );
  });
});
