import { assert, assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";
import {
  CliCompileFailureCode,
  compileSourcesToAstArtifacts,
} from "../../cli/compile.ts";

const writePermission = await Deno.permissions.query({
  name: "write",
});

async function write(path: string, content: string): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, content);
}

Deno.test({
  name:
    "req:cli-compile-001 - file and glob compile emits deterministic AST artifacts with per-unit outcomes",
  ignore: writePermission.state !== "granted",
  fn: async () => {
    const root = await Deno.makeTempDir({ prefix: "uffda-cli-requirement-" });
    const src = join(root, "src");
    const out = join(root, "out");

    await write(join(src, "z", "ok.uff"), "export Main; rule Main = any;");
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
      "z/ok.uff",
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
      await Deno.stat(join(out, "z/ok.uffda.ast.json")).then(() => true),
      true,
    );

    const sample = JSON.parse(
      await Deno.readTextFile(join(out, "a/ok.uffda.ast.json")),
    ) as { imports: unknown[]; exports: unknown[]; rules: unknown[] };
    assert(Array.isArray(sample.imports));
    assert(Array.isArray(sample.exports));
    assert(Array.isArray(sample.rules));
    assert(sample.rules.length >= 1);
    assertEquals(
      result.successes.find((unit) => unit.sourcePath === "a/ok.uff")
        ?.sourcePath,
      "a/ok.uff",
    );
  },
});
