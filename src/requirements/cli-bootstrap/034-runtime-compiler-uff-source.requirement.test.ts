import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const uffdaDir = join(repoRoot, "src", "lang", "uffda");

Deno.test(
  "req:cli-bootstrap-034 - runtime.compiler .uff + resolver host",
  async () => {
    const uff = await Deno.readTextFile(join(uffdaDir, "runtime.compiler.uff"));
    assertEquals(uff.includes("export UffdaRuntimeCompiler"), true);
    assertEquals(uff.includes("rule ModuleBody"), false);
    assertEquals(uff.includes("[CompileDeclarations]"), true);
    assertEquals(uff.includes("(flat [d.imports r.imports])"), true);
    assertEquals(uff.includes("NormalizeModule"), true);
    assertEquals(uff.includes("ExpressionKind.Native"), false);

    const host = await Deno.readTextFile(
      join(uffdaDir, "runtime.compiler.ts"),
    );
    assertEquals(host.includes("runtime.compiler.uff"), true);
    assertEquals(host.includes("resolver.import"), true);
    assertEquals(host.includes("export const UffdaRuntimeCompiler"), false);
    assertEquals(host.includes("normalizeRuntimeExports"), false);
    assertEquals(
      host.includes('from "./runtime.compiler.module.json"'),
      false,
    );

    try {
      await Deno.stat(join(uffdaDir, "runtime.compiler.module.json"));
      assertEquals(true, false, "src must not keep a module.json seed");
    } catch (err) {
      assertEquals(err instanceof Deno.errors.NotFound, true);
    }
  },
);
