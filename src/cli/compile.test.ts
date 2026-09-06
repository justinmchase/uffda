import { assert, assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";
import {
  CliCompileFailureCode,
  compileSourcesToAstArtifacts,
} from "./compile.ts";

const writePermission = await Deno.permissions.query({
  name: "write",
});

async function write(path: string, content: string): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, content);
}

Deno.test({
  name:
    "cli.compile compiles files and globs into deterministic AST JSON artifacts",
  ignore: writePermission.state !== "granted",
  fn: async (t) => {
    await t.step("single file compile writes one artifact", async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-compile-" });
      const src = join(root, "src");
      const out = join(root, "out");
      const file = join(src, "main.uff");

      await write(file, "export Main; rule Main = any;");

      const result = await compileSourcesToAstArtifacts({
        cwd: src,
        sourcePaths: ["main.uff"],
        outputDir: out,
      });

      assertEquals(result.ok, true);
      assertEquals(result.failures.length, 0);
      assertEquals(result.successes.length, 1);
      assertEquals(result.successes[0].sourcePath, "main.uff");
      assertEquals(
        result.successes[0].outputPath,
        join(out, "main.uffda.ast.json"),
      );

      const onDisk = JSON.parse(
        await Deno.readTextFile(join(out, "main.uffda.ast.json")),
      ) as {
        kind: string;
        declarations: unknown[];
      };
      assertEquals(onDisk.kind, "module");
      assertEquals(onDisk.declarations.length, 2);
    });

    await t.step(
      "glob compile is recursive and deterministic with partial failures",
      async () => {
        const root = await Deno.makeTempDir({ prefix: "uffda-cli-compile-" });
        const src = join(root, "src");
        const out = join(root, "out");

        await write(join(src, "b", "ok.uff"), "export Main; rule Main = any;");
        await write(join(src, "a", "bad.uff"), "export Main; rule Main =");
        await write(join(src, "a", "ok.uff"), "export Main; rule Main = any;");
        await write(join(src, "a", "skip.ts"), "export const x = 1;\n");

        const result = await compileSourcesToAstArtifacts({
          cwd: src,
          sourcePaths: ["**/*.uff"],
          outputDir: out,
        });

        assertEquals(result.ok, false);
        assertEquals(result.units.map((unit) => unit.sourcePath), [
          "a/bad.uff",
          "a/ok.uff",
          "b/ok.uff",
        ]);

        const parseFailure = result.failures.find((failure) =>
          failure.sourcePath === "a/bad.uff"
        );
        assert(parseFailure != null);
        assertEquals(parseFailure.code, CliCompileFailureCode.ParseFailure);

        assertEquals(result.successes.length, 2);
        assertEquals(
          await Deno.stat(join(out, "a/ok.uffda.ast.json")).then(() => true),
          true,
        );
        assertEquals(
          await Deno.stat(join(out, "b/ok.uffda.ast.json")).then(() => true),
          true,
        );
      },
    );

    await t.step("directory inputs are rejected", async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-compile-" });
      const src = join(root, "src");
      const out = join(root, "out");
      await write(join(src, "main.uff"), "export Main; rule Main = any;");

      const result = await compileSourcesToAstArtifacts({
        cwd: root,
        sourcePaths: ["src"],
        outputDir: out,
      });

      assertEquals(result.ok, false);
      assertEquals(result.failures.length, 1);
      assertEquals(
        result.failures[0].code,
        CliCompileFailureCode.SourceNotReadable,
      );
      assert(
        result.failures[0].message.includes("Directories are not supported"),
      );
    });

    await t.step("empty glob match fails deterministically", async () => {
      const root = await Deno.makeTempDir({ prefix: "uffda-cli-compile-" });
      const out = join(root, "out");

      const result = await compileSourcesToAstArtifacts({
        cwd: root,
        sourcePaths: ["**/*.uff"],
        outputDir: out,
      });

      assertEquals(result.ok, false);
      assertEquals(result.failures.length, 1);
      assertEquals(
        result.failures[0].code,
        CliCompileFailureCode.SourceNotFound,
      );
      assertEquals(result.failures[0].sourcePath, "**/*.uff");
    });

    await t.step(
      "overwrite policy blocks then permits artifact replacement",
      async () => {
        const root = await Deno.makeTempDir({ prefix: "uffda-cli-compile-" });
        const src = join(root, "src");
        const out = join(root, "out");
        const file = join(src, "main.uff");
        const artifactPath = join(out, "main.uffda.ast.json");

        await write(file, "export Main; rule Main = any;");
        await write(artifactPath, "existing\n");

        const blocked = await compileSourcesToAstArtifacts({
          cwd: src,
          sourcePaths: ["main.uff"],
          outputDir: out,
          overwrite: false,
        });
        assertEquals(blocked.ok, false);
        assertEquals(blocked.failures.length, 1);
        assertEquals(
          blocked.failures[0].code,
          CliCompileFailureCode.OutputExists,
        );

        const allowed = await compileSourcesToAstArtifacts({
          cwd: src,
          sourcePaths: ["main.uff"],
          outputDir: out,
          overwrite: true,
        });
        assertEquals(allowed.ok, true);

        const onDisk = await Deno.readTextFile(artifactPath);
        assert(onDisk.includes('"kind": "module"'));
      },
    );
  },
});
