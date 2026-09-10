import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:uffda-runtime-compilation-007 - runtime compiler normalizes re-exports",
  async () => {
    const uff = await Deno.readTextFile(
      join(repoRoot, "src/lang/uffda/runtime.compiler.uff"),
    );
    assertEquals(uff.includes("NormalizeModule"), true);
    assertEquals(uff.includes("FinalizeExports"), true);
    assertEquals(uff.includes('(to_set (pluck r "name"))'), true);
    assertEquals(uff.includes('(to_set (pluck f "name"))'), true);
    assertEquals(uff.includes('{ ..._, kind: "import" }'), true);
    assertEquals(uff.includes('{ ..._, kind: "func" }'), true);
    assertEquals(uff.includes("CompileFuncDeclaration"), true);
    assertEquals(uff.includes("ExpressionKind.Native"), false);
    assertEquals(uff.includes("normalizeModule"), false);

    const host = await Deno.readTextFile(
      join(repoRoot, "src/lang/uffda/runtime.compiler.ts"),
    );
    assertEquals(host.includes("normalizeRuntimeExports"), false);
  },
);
