import { MatchKind } from "../match.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { executeModuleDeclaration } from "../runtime/module.execute.ts";
import type { UffdaSyntaxModule } from "../lang/uffda/syntax.types.ts";
import { UffdaRuntimeCompiler as PreviousUffdaRuntimeCompiler } from "./previous_uffda_runtime_compiler.ts";

/**
 * Compile-pipeline lower stage: run the previous published UffdaRuntimeCompiler
 * on a syntax AST to produce a ModuleDeclaration.
 *
 * Uses the frozen previous compiler snapshot (not Resolver.import of in-tree
 * runtime.compiler.uff from ./bin) so compiling that module cannot recurse and
 * so `deno compile` binaries can lower offline.
 * See compiler-bootstrap.spec.md § Compile pipeline and recursion break.
 */
const previousCompiler = PreviousUffdaRuntimeCompiler as ModuleDeclaration;

/** Lower a Uffda syntax AST to a runtime ModuleDeclaration. */
export async function lowerUffdaSyntaxModule(
  syntaxModule: UffdaSyntaxModule,
): Promise<ModuleDeclaration> {
  const match = await executeModuleDeclaration(previousCompiler, {
    input: syntaxModule,
    entryRuleName: "UffdaRuntimeCompiler",
  });
  if (match.kind !== MatchKind.Ok) {
    const detail = "message" in match && match.message
      ? `: ${match.message}`
      : "";
    throw new Error(
      `Failed to lower Uffda syntax module (${match.kind})${detail}`,
    );
  }
  return match.value as ModuleDeclaration;
}
