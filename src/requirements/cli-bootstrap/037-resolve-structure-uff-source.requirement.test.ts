import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const pattern = join(repoRoot, "src", "lang", "pattern");

Deno.test(
  "req:cli-bootstrap-037 - resolve/structure .uff source closes B9",
  async () => {
    const resolveSrc = await Deno.readTextFile(join(pattern, "resolve.uff"));
    assertEquals(resolveSrc.includes("export Resolve"), true);
    assertEquals(resolveSrc.includes('import "./pattern.uff" Pattern'), true);
    assertEquals(resolveSrc.includes("(flat (coalesce a []))"), true);
    assertEquals(resolveSrc.includes("ExpressionKind.Native"), false);
    assertEquals(resolveSrc.includes("Array.isArray"), false);

    const structureSrc = await Deno.readTextFile(
      join(pattern, "structure.uff"),
    );
    assertEquals(structureSrc.includes("export Structure"), true);
    assertEquals(structureSrc.includes('import "./pattern.uff" Pattern'), true);
    assertEquals(structureSrc.includes("(from_entries"), true);
    assertEquals(structureSrc.includes("Object.fromEntries"), false);
    assertEquals(structureSrc.includes("ExpressionKind.Native"), false);

    const atomicSrc = await Deno.readTextFile(join(pattern, "atomic.uff"));
    assertEquals(atomicSrc.includes('import "./resolve.uff" Resolve'), true);
    assertEquals(
      atomicSrc.includes('import "./structure.uff" Structure'),
      true,
    );
    assertEquals(atomicSrc.includes("resolve.ts"), false);
    assertEquals(atomicSrc.includes("structure.ts"), false);

    for (const twin of ["resolve.ts", "structure.ts"]) {
      try {
        await Deno.stat(join(pattern, twin));
        throw new Error(`${twin} twin must be deleted`);
      } catch (error) {
        assertEquals(error instanceof Deno.errors.NotFound, true);
      }
    }
  },
);
