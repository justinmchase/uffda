import { assertEquals } from "@std/assert";

Deno.test("check-rust script declares the Checks workflow commands", async () => {
  const source = await Deno.readTextFile(
    new URL("./check-rust.ts", import.meta.url),
  );
  for (const needle of [
    '"--check"',
    "clippy",
    '"-D"',
    '"warnings"',
    '"--workspace"',
    '"--locked"',
  ]) {
    assertEquals(source.includes(needle), true, `missing ${needle}`);
  }
});
