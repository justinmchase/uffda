import { assert, assertEquals } from "@std/assert";
import { fromFileUrl, join, toFileUrl } from "@std/path";
import { MatchErrorCode } from "../../match.ts";
import { compileSourcesToAstArtifacts } from "../../cli/compile.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../patterns/pattern.ts";
import { Resolver } from "../resolve.ts";
import { ModuleImportResultKind } from "./resolver.ts";
import { Scope } from "../scope.ts";

function context() {
  return {
    scope: Scope.Default(),
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    } as const,
  };
}

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test("uff.artifact.resolver loads Digit from mirrored bin AST", async () => {
  const artifactRoot = await Deno.makeTempDir({ prefix: "uffda-uff-resolve-" });
  try {
    const digitUff = join(
      repoRoot,
      "src/lang/common/characters/digit.uff",
    );
    const compiled = await compileSourcesToAstArtifacts({
      cwd: repoRoot,
      sourcePaths: [digitUff],
      outputDir: join(artifactRoot, "ast"),
      overwrite: true,
    });
    assertEquals(compiled.ok, true);

    const resolver = new Resolver({ cwd: repoRoot, artifactRoot });
    const result = await resolver.import(toFileUrl(digitUff), context());
    assertEquals(result.kind, ModuleImportResultKind.Module);
    if (result.kind !== ModuleImportResultKind.Module) return;
    assertEquals([...result.module.exports.keys()], ["Digit"]);
    assertEquals(result.module.moduleUrl.href, toFileUrl(digitUff).href);
  } finally {
    await Deno.remove(artifactRoot, { recursive: true });
  }
});

Deno.test("uff.artifact.resolver fails clearly when artifact is missing", async () => {
  const artifactRoot = await Deno.makeTempDir({
    prefix: "uffda-uff-missing-",
  });
  try {
    const digitUff = join(
      repoRoot,
      "src/lang/common/characters/digit.uff",
    );
    const resolver = new Resolver({ cwd: repoRoot, artifactRoot });
    const result = await resolver.import(toFileUrl(digitUff), context());
    assertEquals(result.kind, ModuleImportResultKind.Error);
    if (result.kind !== ModuleImportResultKind.Error) return;
    assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
    assert(result.error.message.includes("compile the .uff source first"));
    assert(result.error.message.includes("digit.uffda.ast.json"));
  } finally {
    await Deno.remove(artifactRoot, { recursive: true });
  }
});

Deno.test("uff.artifact.resolver resolves nested .uff imports via artifacts", async () => {
  const cwd = await Deno.makeTempDir({ prefix: "uffda-uff-nested-" });
  const artifactRoot = join(cwd, "bin");
  try {
    const leafPath = join(cwd, "leaf.uff");
    const rootPath = join(cwd, "root.uff");
    await Deno.writeTextFile(leafPath, "export rule Leaf = any;\n");
    await Deno.writeTextFile(
      rootPath,
      `import "./leaf.uff" Leaf;\nexport rule Root = Leaf;\n`,
    );

    const compiled = await compileSourcesToAstArtifacts({
      cwd,
      sourcePaths: [leafPath, rootPath],
      outputDir: join(artifactRoot, "ast"),
      overwrite: true,
    });
    assertEquals(compiled.ok, true, JSON.stringify(compiled.failures));

    const resolver = new Resolver({ cwd, artifactRoot });
    const result = await resolver.import(toFileUrl(rootPath), context());
    assertEquals(result.kind, ModuleImportResultKind.Module);
    if (result.kind !== ModuleImportResultKind.Module) return;
    assertEquals([...result.module.exports.keys()], ["Root"]);
    assertEquals(result.module.imports.has("Leaf"), true);
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
});
