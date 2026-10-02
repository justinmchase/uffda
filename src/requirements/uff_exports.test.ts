import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { uffExportNames } from "./uff_exports.ts";

Deno.test("requirements.uff_exports uffExportNames", async (t) => {
  const dir = await Deno.makeTempDir();
  try {
    await t.step("lists standalone and inline exports", async () => {
      const path = join(dir, "a.uff");
      await Deno.writeTextFile(
        path,
        'export A;\nexport rule B = "b";\nrule A = "a";\n',
      );
      assertEquals(await uffExportNames(path), ["A", "B"]);
    });

    await t.step("rejects a source that does not compile", async () => {
      const path = join(dir, "bad.uff");
      await Deno.writeTextFile(path, "rule = ;");
      await assertRejects(() => uffExportNames(path));
    });
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
