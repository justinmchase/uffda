import { assertEquals } from "@std/assert";
import { assertRejects } from "@std/assert/rejects";
import { sha256 } from "./sha256.ts";

Deno.test("globals.sha256 is stable for fixed text", async () => {
  const a = await sha256("hello");
  const b = await sha256("hello");
  assertEquals(a, b);
});

Deno.test("globals.sha256 matches a known digest", async () => {
  const digest = await sha256("hello");
  const hex = Array.from(digest).map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  assertEquals(
    hex,
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

Deno.test("globals.sha256 rejects non-strings", async () => {
  await assertRejects(
    () => sha256(1 as unknown as string),
    TypeError,
  );
});
