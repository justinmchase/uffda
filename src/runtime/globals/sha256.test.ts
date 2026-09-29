import { assertEquals } from "@std/assert";
import { assertRejects } from "@std/assert/rejects";
import { sha256 } from "./sha256.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

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

Deno.test("globals.sha256 carries metadata", () => {
  assertEquals(
    metadataOf(sha256)?.parameters.map((p) => p.name),
    ["text"],
  );
});

Deno.test("globals.sha256 observes the raw string", async () => {
  assertEquals(
    await sha256(new Wrapped("abc", rootOrigin(0))),
    await sha256("abc"),
  );
});
