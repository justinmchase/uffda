import { assertEquals } from "@std/assert";
import { offsetToPosition, positionToOffset } from "./lsp.positions.ts";

Deno.test("cli.lsp.positions", async (t) => {
  const source = "line0\nline1\nline2";

  await t.step("positionToOffset resolves the first line", () => {
    assertEquals(positionToOffset(source, { line: 0, character: 3 }), 3);
  });

  await t.step("positionToOffset resolves a later line", () => {
    assertEquals(positionToOffset(source, { line: 1, character: 2 }), 8);
  });

  await t.step("positionToOffset clamps past the line end", () => {
    assertEquals(positionToOffset(source, { line: 0, character: 999 }), 5);
  });

  await t.step("positionToOffset clamps past the document end", () => {
    assertEquals(
      positionToOffset(source, { line: 99, character: 0 }),
      source.length,
    );
  });

  await t.step("offsetToPosition round-trips with positionToOffset", () => {
    for (const offset of [0, 3, 5, 6, 8, source.length]) {
      const position = offsetToPosition(source, offset);
      assertEquals(positionToOffset(source, position), offset);
    }
  });
});
