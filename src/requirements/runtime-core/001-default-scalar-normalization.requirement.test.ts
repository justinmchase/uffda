import { assertEquals, assertThrows } from "@std/assert";
import { Input, InputNormalizationMode } from "../../input.ts";
import { unwrap } from "../../wrapped.ts";

Deno.test("req:runtime-core-001 - Runtime defaults to scalar normalization and rejects unknown normalization modes", async (t) => {
  await t.step(
    "default mode is scalar and treats iterable input as one item",
    async () => {
      const input = Input.From("abc");
      const next = await input.next();

      assertEquals(input.kind, InputNormalizationMode.Scalar);
      assertEquals(unwrap(next.value), "abc");
      assertEquals(await next.done(), true);
    },
  );

  await t.step(
    "explicit scalar mode treats iterable input as one item",
    async () => {
      const input = Input.From([1, 2, 3], {
        kind: InputNormalizationMode.Scalar,
      });
      const next = await input.next();

      assertEquals(unwrap(next.value), [1, 2, 3]);
      assertEquals(await next.done(), true);
    },
  );

  await t.step("unknown normalization mode throws explicit error", () => {
    assertThrows(
      () => Input.From("abc", { kind: "bogus" as InputNormalizationMode }),
      TypeError,
      "Unknown input normalization mode",
    );
  });
});
