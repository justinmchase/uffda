import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  findProjectFile,
  loadProject,
  loadProjectFile,
  ProjectLoadKind,
} from "./load.ts";

async function withTree(
  files: Record<string, string>,
  body: (root: string) => Promise<void>,
): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "uffda-project-" });
  try {
    for (const [path, text] of Object.entries(files)) {
      const full = join(root, path);
      await Deno.mkdir(join(full, ".."), { recursive: true });
      await Deno.writeTextFile(full, text);
    }
    await body(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

Deno.test("project.load finds the nearest project file", async (t) => {
  await t.step("in the start directory or an ancestor", async () => {
    await withTree({
      "uffda.jsonc": "{}",
      "app/uffda.jsonc": "{}",
      "app/src/deep/a.uff": "",
    }, async (root) => {
      assertEquals(
        await findProjectFile(join(root, "app", "src", "deep")),
        join(root, "app", "uffda.jsonc"),
      );
      assertEquals(await findProjectFile(root), join(root, "uffda.jsonc"));
    });
  });

  await t.step("ignoring a directory with the file's name", async () => {
    await withTree(
      { "app/uffda.jsonc/x": "", "uffda.jsonc": "{}" },
      async (root) => {
        assertEquals(
          await findProjectFile(join(root, "app")),
          join(root, "uffda.jsonc"),
        );
      },
    );
  });
});

Deno.test("project.loadProject", async (t) => {
  await t.step("loads a valid project", async () => {
    await withTree({
      "uffda.jsonc": '{ "languages": ["./a.uff"] }',
      "src/x": "",
    }, async (root) => {
      const result = await loadProject(join(root, "src"));
      assert(result.kind === ProjectLoadKind.Loaded);
      assertEquals(result.project.root, root);
      assertEquals(result.project.languages, ["./a.uff"]);
    });
  });

  await t.step("reports an invalid project with its path", async () => {
    await withTree({ "uffda.jsonc": '{ "languages": 1 }' }, async (root) => {
      const result = await loadProject(root);
      assert(result.kind === ProjectLoadKind.Invalid);
      assertEquals(result.path, join(root, "uffda.jsonc"));
      assertEquals(result.problems.length, 1);
    });
  });

  await t.step("is missing when no ancestor has one", async () => {
    const root = await Deno.makeTempDir({ prefix: "uffda-no-project-" });
    try {
      const found = await findProjectFile(root);
      // A project file above the temp directory would be found instead.
      if (found === undefined) {
        assertEquals(await loadProject(root), {
          kind: ProjectLoadKind.Missing,
        });
      }
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  });
});

Deno.test("project.loadProjectFile", async (t) => {
  await t.step("loads the named file, whatever its name", async () => {
    await withTree({
      "config/custom.jsonc": `{ "imports": { "@a/b": "jsr:@a/b@^1" } }`,
    }, async (root) => {
      const loaded = await loadProjectFile(join(root, "config/custom.jsonc"));
      assert(loaded.kind === ProjectLoadKind.Loaded);
      assertEquals(loaded.project.root, join(root, "config"));
      assertEquals(loaded.project.imports.get("@a/b"), "jsr:@a/b@^1");
    });
  });

  await t.step("reports a missing file as a problem", async () => {
    await withTree({}, async (root) => {
      const path = join(root, "uffda.jsonc");
      const loaded = await loadProjectFile(path);
      assert(loaded.kind === ProjectLoadKind.Invalid);
      assertEquals(loaded.path, path);
      assertEquals(loaded.problems.length, 1);
    });
  });
});
