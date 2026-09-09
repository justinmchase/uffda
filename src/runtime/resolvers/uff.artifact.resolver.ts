import type { UffdaSyntaxModule } from "../../lang/uffda/syntax.types.ts";
import { isModuleDeclaration } from "../declarations/is_module_declaration.ts";
import {
  type IModuleResolver,
  moduleDeclarationResolutionResult,
  type ModuleDeclarationResult,
  moduleDeclarationResult,
  type ModuleResolutionContext,
  moduleResolutionError,
} from "./resolver.ts";
import { astArtifactPathForUffUrl } from "./artifact_path.ts";

export type UffArtifactResolverOptions = {
  cwd: string;
  artifactRoot: string;
};

function isUffdaSyntaxModule(value: unknown): value is UffdaSyntaxModule {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.kind === "module" && Array.isArray(record.declarations);
}

/**
 * Resolves logical `.uff` module URLs by loading the mirrored compiled JSON
 * under `<artifactRoot>/ast/...`.
 *
 * Artifacts are ModuleDeclarations produced by the compile pipeline (parse →
 * previous published UffdaRuntimeCompiler → write). Resolve only loads JSON —
 * it does not call the runtime compiler again.
 */
export class UffArtifactResolver implements IModuleResolver {
  public readonly extension = ".uff";
  private readonly cwd: string;
  private readonly artifactRoot: string;

  constructor(options: UffArtifactResolverOptions) {
    this.cwd = options.cwd;
    this.artifactRoot = options.artifactRoot;
  }

  async resolveModule(
    moduleUrl: URL,
    context: ModuleResolutionContext,
  ): Promise<ModuleDeclarationResult> {
    const artifactPath = astArtifactPathForUffUrl(
      this.cwd,
      this.artifactRoot,
      moduleUrl,
    );

    let text: string;
    try {
      text = await Deno.readTextFile(artifactPath);
    } catch (err) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to resolve ${moduleUrl}: compile the .uff source first ` +
          `(expected artifact at ${artifactPath})`,
        context,
        err,
      ));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to parse module artifact at ${artifactPath}`,
        context,
        err,
      ));
    }

    if (isModuleDeclaration(parsed)) {
      return moduleDeclarationResult(parsed);
    }

    if (isUffdaSyntaxModule(parsed)) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Artifact at ${artifactPath} is a syntax AST; recompile with a CLI ` +
          `that emits ModuleDeclarations (imports/exports/rules)`,
        context,
      ));
    }

    return moduleDeclarationResolutionResult(moduleResolutionError(
      `Artifact at ${artifactPath} is not a ModuleDeclaration`,
      context,
    ));
  }
}
