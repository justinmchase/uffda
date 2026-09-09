import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const pattern = join(repoRoot, "src", "lang", "pattern");

Deno.test(
  "req:cli-bootstrap-036 - prefix .uff source closes B8",
  async () => {
    const prefixSrc = await Deno.readTextFile(join(pattern, "prefix.uff"));
    assertEquals(prefixSrc.includes("export Prefix"), true);
    assertEquals(prefixSrc.includes("rule StarMinMax"), true);
    assertEquals(prefixSrc.includes("rule StarMinOpen"), true);
    assertEquals(prefixSrc.includes("rule StarMaxOnly"), true);
    assertEquals(prefixSrc.includes("rule StarMinOnly"), true);
    assertEquals(prefixSrc.includes("rule StarBare"), true);
    assertEquals(prefixSrc.includes("ExpressionKind.Native"), false);
    assertEquals(prefixSrc.includes("RangeError"), false);
    assertEquals(prefixSrc.includes("throw"), false);

    const thenSrc = await Deno.readTextFile(join(pattern, "then.uff"));
    assertEquals(thenSrc.includes('import "./prefix.uff" Prefix'), true);
    assertEquals(thenSrc.includes("prefix.ts"), false);

    try {
      await Deno.stat(join(pattern, "prefix.ts"));
      throw new Error("prefix.ts twin must be deleted");
    } catch (error) {
      assertEquals(error instanceof Deno.errors.NotFound, true);
    }
  },
);
