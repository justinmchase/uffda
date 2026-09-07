import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const identifierUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "identifier.uff",
);

Deno.test(
  "req:cli-bootstrap-014 - identifier.uff exports Identifier with flat/join projection",
  async () => {
    const source = await Deno.readTextFile(identifierUff);
    assertEquals(source.includes("export rule Identifier"), true);
    assertEquals(source.includes('(join (flat _) "")'), true);
  },
);
