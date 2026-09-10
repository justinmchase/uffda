import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:pattern-syntax-001 - pattern string escape specs and literals rules exist",
  async () => {
    const spec = await Deno.readTextFile(
      join(
        repoRoot,
        ".agents/specifications/languages/pattern-syntax/string-literals.spec.md",
      ),
    );
    const literals = await Deno.readTextFile(
      join(repoRoot, "src/lang/pattern/literals.uff"),
    );
    assertEquals(spec.includes("\\t"), true);
    assertEquals(spec.includes("\\n"), true);
    assertEquals(spec.includes("\\r"), true);
    assertEquals(literals.includes("EscapedPatternStringTab"), true);
    assertEquals(literals.includes("EscapedPatternStringNewline"), true);
    assertEquals(literals.includes("EscapedPatternStringReturn"), true);
    assertEquals(literals.includes("EscapedPatternStringBackslash"), true);
  },
);
