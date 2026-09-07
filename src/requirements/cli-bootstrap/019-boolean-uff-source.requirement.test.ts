import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const booleanUff = join(repoRoot, "src", "lang", "expression", "boolean.uff");

Deno.test(
  "req:cli-bootstrap-019 - boolean.uff exports Boolean with object projection",
  async () => {
    const source = await Deno.readTextFile(booleanUff);
    assertEquals(source.includes("export Boolean"), true);
    assertEquals(source.includes('rule TrueKeyword = "true" -> true'), true);
    assertEquals(source.includes('rule FalseKeyword = "false" -> false'), true);
    assertEquals(source.includes('-> { kind: "boolean", value: _ }'), true);
  },
);
