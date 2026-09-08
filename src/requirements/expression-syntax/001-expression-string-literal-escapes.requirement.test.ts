import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:expression-syntax-001 - expression string escape rules exist",
  async () => {
    const source = await Deno.readTextFile(
      join(repoRoot, "src/lang/expression/string.uff"),
    );
    assertEquals(source.includes("rule EscapedTab"), true);
    assertEquals(source.includes("rule EscapedNewline"), true);
    assertEquals(source.includes("rule EscapedReturn"), true);
    assertEquals(source.includes("rule EscapedBackslash"), true);
  },
);
