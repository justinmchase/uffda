import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const connectingUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "characters",
  "connecting.uff",
);

Deno.test(
  "req:cli-bootstrap-006 - connecting.uff exports Connecting",
  async () => {
    const source = await Deno.readTextFile(connectingUff);
    assertEquals(source.includes("export rule Connecting"), true);
    assertEquals(source.includes("\\cPc"), true);
  },
);
