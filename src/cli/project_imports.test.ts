import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { projectImports } from "./project_imports.ts";

async function withRoot(body: (root: string) => Promise<void>): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "uffda-project-imports-" });
  try {
    await body(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

Deno.test("cli.project_imports", async (t) => {
  await t.step("reads the nearest project file's imports", async () => {
    await withRoot(async (root) => {
      await Deno.writeTextFile(
        join(root, "uffda.jsonc"),
        '{ "imports": { "@a/b": "jsr:@a/b@^1" } }',
      );
      await Deno.mkdir(join(root, "src"));
      const result = await projectImports(join(root, "src"));
      assert(result.ok);
      assertEquals([...result.imports], [["@a/b", "jsr:@a/b@^1"]]);
    });
  });

  await t.step("reads the project file a config path names", async () => {
    await withRoot(async (root) => {
      const path = join(root, "other.jsonc");
      await Deno.writeTextFile(path, '{ "imports": { "@c": "jsr:@c/d@^2" } }');
      const result = await projectImports(root, path);
      assert(result.ok);
      assertEquals([...result.imports], [["@c", "jsr:@c/d@^2"]]);
    });
  });

  await t.step("has no imports without a project", async () => {
    await withRoot(async (root) => {
      const result = await projectImports(root);
      assert(result.ok);
      assertEquals(result.imports.size, 0);
    });
  });

  await t.step("reports each problem of an invalid project", async () => {
    await withRoot(async (root) => {
      const path = join(root, "uffda.jsonc");
      await Deno.writeTextFile(path, '{ "imports": [], "extra": 1 }');
      const result = await projectImports(root);
      assert(!result.ok);
      const lines = result.message.split("\n");
      assertEquals(lines.length, 2);
      assert(lines.every((line) => line.startsWith(`${path}: `)), lines[0]);
    });
  });

  await t.step("reports a missing config path", async () => {
    await withRoot(async (root) => {
      const result = await projectImports(root, join(root, "missing.jsonc"));
      assertEquals(result.ok, false);
    });
  });
});
