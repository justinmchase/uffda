import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const nullishUff = join(repoRoot, "src", "lang", "expression", "nullish.uff");

Deno.test(
  "req:cli-bootstrap-020 - nullish.uff exports Nullish with value projection",
  async () => {
    const source = await Deno.readTextFile(nullishUff);
    assertEquals(source.includes("export Nullish"), true);
    assertEquals(source.includes('rule NullKeyword = "null" -> null'), true);
    assertEquals(
      source.includes('rule UndefinedKeyword = "undefined" -> undefined'),
      true,
    );
    assertEquals(source.includes('-> { kind: "value", value: _ }'), true);
  },
);
