import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:expression-syntax-001 - expression string escape rules exist",
  async () => {
    const source = await Deno.readTextFile(
      join(repoRoot, "src/lang/expression/string.ts"),
    );
    assertEquals(source.includes('name: "EscapedTab"'), true);
    assertEquals(source.includes('name: "EscapedNewline"'), true);
    assertEquals(source.includes('name: "EscapedReturn"'), true);
    assertEquals(source.includes('name: "EscapedBackslash"'), true);
  },
);
