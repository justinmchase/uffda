import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const modUff = join(repoRoot, "src", "lang", "source", "mod.uff");

Deno.test(
  "req:cli-bootstrap-040 - source mod.uff pipelines Source via B6 std helpers",
  async () => {
    const source = await Deno.readTextFile(modUff);
    assertEquals(source.includes("export rule Source"), true);
    assertEquals(source.includes("export NormalizedText"), true);
    assertEquals(source.includes("...(iterable t)"), true);
    assertEquals(source.includes('(match_leaf_offset "start")'), true);
    assertEquals(source.includes("(normalization_map _)"), true);
    assertEquals(source.includes("(line_starts t)"), true);
  },
);
