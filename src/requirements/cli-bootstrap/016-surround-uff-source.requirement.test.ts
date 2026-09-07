import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const surroundUff = join(repoRoot, "src", "lang", "common", "surround.uff");

Deno.test(
  "req:cli-bootstrap-016 - surround.uff exports parametric Surround with -> p",
  async () => {
    const source = await Deno.readTextFile(surroundUff);
    assertEquals(source.includes("export rule Surround<L, P, R>"), true);
    assertEquals(source.includes("L? p:P R?"), true);
    assertEquals(source.includes("-> p"), true);
  },
);
