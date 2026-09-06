import { assertEquals } from "@std/assert";
import { fromFileUrl, join, resolve, toFileUrl } from "@std/path";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { Scope } from "../../runtime/scope.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const digitUff = resolve(repoRoot, "src/lang/common/characters/digit.uff");
const digitArtifact = join(
  repoRoot,
  "bin/ast/src/lang/common/characters/digit.uffda.ast.json",
);

let binArtifactPresent = false;
try {
  await Deno.stat(digitArtifact);
  binArtifactPresent = true;
} catch {
  // Local unit runs skip unless `deno task compile:lang` (or Checks) wrote ./bin.
}

function context() {
  return {
    scope: Scope.Default(),
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    } as const,
  };
}

/**
 * Bootstrap e2e: expects Checks (or a local `compile:lang`) to have already
 * written Digit into ./bin. Does not compile.
 */
Deno.test({
  name:
    "req:cli-bootstrap-005 - Resolver imports Digit .uff from workflow ./bin",
  ignore: !binArtifactPresent,
  fn: async () => {
    const resolver = new Resolver({
      cwd: repoRoot,
      artifactRoot: join(repoRoot, "bin"),
    });
    const result = await resolver.import(toFileUrl(digitUff), context());
    assertEquals(result.kind, ModuleImportResultKind.Module);
    if (result.kind !== ModuleImportResultKind.Module) return;
    assertEquals([...result.module.exports.keys()], ["Digit"]);
    assertEquals(result.module.moduleUrl.href, toFileUrl(digitUff).href);
  },
});
