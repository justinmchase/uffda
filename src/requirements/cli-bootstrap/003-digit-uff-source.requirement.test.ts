import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const digitUff = join(
  repoRoot,
  "src",
  "lang",
  "common",
  "characters",
  "digit.uff",
);

Deno.test(
  "req:cli-bootstrap-003 - digit.uff exports Digit",
  async () => {
    const source = await Deno.readTextFile(digitUff);
    assertEquals(source.includes("export rule Digit"), true);
    assertEquals(source.includes("\\cNd"), true);
  },
);
