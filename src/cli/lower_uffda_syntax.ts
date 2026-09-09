import { MatchKind } from "../match.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { executeModuleDeclaration } from "../runtime/module.execute.ts";
import type { UffdaSyntaxModule } from "../lang/uffda/syntax.types.ts";

/**
 * Compile-pipeline lower stage: run the previous published UffdaRuntimeCompiler
 * on a syntax AST to produce a ModuleDeclaration.
 *
 * Uses the previous package (not Resolver.import of in-tree
 * runtime.compiler.uff from ./bin) so compiling that module cannot recurse.
 * See compiler-bootstrap.spec.md § Compile pipeline and recursion break.
 */
const PREVIOUS_COMPILER_URL =
  "https://jsr.io/@justinmchase/uffda/0.1.15/src/lang/uffda/runtime.compiler.ts";

let previousCompiler:
  | Promise<ModuleDeclaration>
  | ModuleDeclaration
  | undefined;

async function previousUffdaRuntimeCompiler(): Promise<ModuleDeclaration> {
  if (!previousCompiler) {
    previousCompiler = (async () => {
      const mod = await import(PREVIOUS_COMPILER_URL);
      return mod.UffdaRuntimeCompiler as ModuleDeclaration;
    })();
  }
  return await previousCompiler;
}

/** Lower a Uffda syntax AST to a runtime ModuleDeclaration. */
export async function lowerUffdaSyntaxModule(
  syntaxModule: UffdaSyntaxModule,
): Promise<ModuleDeclaration> {
  const compiler = await previousUffdaRuntimeCompiler();
  const match = await executeModuleDeclaration(compiler, {
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
