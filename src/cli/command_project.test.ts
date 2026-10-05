import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { commandProject } from "./command_project.ts";

async function withRoot(body: (root: string) => Promise<void>): Promise<void> {
  const root = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "uffda-command-project-" }),
  );
  try {
    await body(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

Deno.test("cli.command_project", async (t) => {
  await t.step("reads the nearest project file", async () => {
    await withRoot(async (root) => {
      await Deno.writeTextFile(
        join(root, "uffda.jsonc"),
        '{ "imports": { "@a/b": "jsr:@a/b@^1" } }',
      );
      await Deno.mkdir(join(root, "src"));
      const result = await commandProject(join(root, "src"));
      assert(result.ok);
      assertEquals([...result.imports], [["@a/b", "jsr:@a/b@^1"]]);
      assertEquals(result.artifacts, { root, outDir: join(root, "bin") });
    });
  });

  await t.step("takes the output directory from the project", async () => {
    await withRoot(async (root) => {
      await Deno.writeTextFile(
        join(root, "uffda.jsonc"),
        '{ "outDir": "./build" }',
      );
      const result = await commandProject(root);
      assert(result.ok);
      assertEquals(result.artifacts, { root, outDir: join(root, "build") });
    });
  });

  await t.step("reads the project file a config path names", async () => {
    await withRoot(async (root) => {
      await Deno.mkdir(join(root, "config"));
      const path = join(root, "config", "other.jsonc");
      await Deno.writeTextFile(path, '{ "imports": { "@c": "jsr:@c/d@^2" } }');
      const result = await commandProject(root, path);
      assert(result.ok);
      assertEquals([...result.imports], [["@c", "jsr:@c/d@^2"]]);
      assertEquals(result.artifacts.root, join(root, "config"));
    });
  });

  await t.step("without a project, uses the start's ./bin", async () => {
    await withRoot(async (root) => {
      const result = await commandProject(root);
      assert(result.ok);
      assertEquals(result.imports.size, 0);
      assertEquals(result.artifacts, { root, outDir: join(root, "bin") });
    });
  });

  await t.step("reports each problem of an invalid project", async () => {
    await withRoot(async (root) => {
      const path = join(root, "uffda.jsonc");
      await Deno.writeTextFile(path, '{ "imports": [], "extra": 1 }');
      const result = await commandProject(root);
      assert(!result.ok);
      const lines = result.message.split("\n");
      assertEquals(lines.length, 2);
      assert(lines.every((line) => line.startsWith(`${path}: `)), lines[0]);
    });
  });

  await t.step("reports a missing config path", async () => {
    await withRoot(async (root) => {
      const result = await commandProject(root, join(root, "missing.jsonc"));
      assertEquals(result.ok, false);
    });
  });
});
