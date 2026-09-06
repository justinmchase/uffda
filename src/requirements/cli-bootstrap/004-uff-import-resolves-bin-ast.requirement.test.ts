import { assertEquals } from "@std/assert";
import { fromFileUrl, join, resolve, toFileUrl } from "@std/path";
import { compileSourcesToAstArtifacts } from "../../cli/compile.ts";
import { MatchErrorCode } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { Scope } from "../../runtime/scope.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

function context() {
  return {
    scope: Scope.Default(),
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    } as const,
  };
}

Deno.test(
  "req:cli-bootstrap-004 - .uff import resolves mirrored bin syntax AST",
  async () => {
    const artifactRoot = await Deno.makeTempDir({
      prefix: "uffda-cli-bootstrap-004-",
    });
    try {
      const digitUff = resolve(
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
    } finally {
      await Deno.remove(artifactRoot, { recursive: true });
    }
  },
);

Deno.test(
  "req:cli-bootstrap-004 - missing bin artifact fails module resolution",
  async () => {
    const artifactRoot = await Deno.makeTempDir({
      prefix: "uffda-cli-bootstrap-004-missing-",
    });
    try {
      const digitUff = resolve(
        repoRoot,
        "src/lang/common/characters/digit.uff",
      );
      const resolver = new Resolver({ cwd: repoRoot, artifactRoot });
      const result = await resolver.import(toFileUrl(digitUff), context());
      assertEquals(result.kind, ModuleImportResultKind.Error);
      if (result.kind !== ModuleImportResultKind.Error) return;
      assertEquals(result.error.code, MatchErrorCode.ModuleResolution);
    } finally {
      await Deno.remove(artifactRoot, { recursive: true });
    }
  },
);
