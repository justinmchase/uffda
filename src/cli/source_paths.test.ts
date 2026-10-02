import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { expandSourcePaths, SourcePathFailureCode } from "./source_paths.ts";

Deno.test("cli.source_paths expandSourcePaths", async (t) => {
  const cwd = await Deno.makeTempDir();
  await Deno.mkdir(join(cwd, "src"));
  await Deno.writeTextFile(join(cwd, "src", "b.uff"), "");
  await Deno.writeTextFile(join(cwd, "src", "a.uff"), "");
  await Deno.writeTextFile(join(cwd, "top.uff"), "");

  try {
    await t.step(
      "expands globs and paths, deduplicated and sorted",
      async () => {
        assertEquals(
          await expandSourcePaths(cwd, ["src/*.uff", "src/a.uff", "top.uff"]),
          {
            files: [
              join(cwd, "src", "a.uff"),
              join(cwd, "src", "b.uff"),
              join(cwd, "top.uff"),
            ],
            explicit: new Set([
              join(cwd, "src", "a.uff"),
              join(cwd, "top.uff"),
            ]),
            failures: [],
          },
        );
      },
    );

    await t.step("globs skip excluded directories", async () => {
      const { files } = await expandSourcePaths(cwd, ["**/*.uff"], ["src"]);
      assertEquals(files, [join(cwd, "top.uff")]);
    });

    await t.step("reports globs and paths that name no file", async () => {
      const { files, failures } = await expandSourcePaths(cwd, [
        "none/*.uff",
        "missing.uff",
        "src",
      ]);
      assertEquals(files, []);
      assertEquals(
        failures.map(({ code, sourcePath }) => [code, sourcePath]),
        [
          [SourcePathFailureCode.NotFound, "none/*.uff"],
          [SourcePathFailureCode.NotFound, "missing.uff"],
          [SourcePathFailureCode.NotReadable, "src"],
        ],
      );
    });
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});
