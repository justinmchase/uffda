import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:uffda-runtime-compilation-007 - runtime compiler normalizes re-exports",
  async () => {
    const source = await Deno.readTextFile(
      join(repoRoot, "src/lang/uffda/runtime.compiler.ts"),
    );
    assertEquals(source.includes("ExportDeclarationKind.Import"), true);
    assertEquals(source.includes("importedNames"), true);
    assertEquals(source.includes("ruleNames"), true);
  },
);
