import type { UffdaSyntaxModule } from "../../lang/uffda/syntax.types.ts";
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
 * Resolves logical `.uff` module URLs by loading the mirrored compiled syntax-AST
 * JSON under `<artifactRoot>/ast/...` and lowering it to a ModuleDeclaration.
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
        `Unable to parse syntax AST artifact at ${artifactPath}`,
        context,
        err,
      ));
    }

    if (!isUffdaSyntaxModule(parsed)) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Artifact at ${artifactPath} is not a Uffda syntax module AST`,
        context,
      ));
    }

    try {
      // Dynamic import avoids a static cycle: runtime → lang → grammar → Resolver.
      const { compileUffdaSyntaxModule } = await import(
        "../../lang/uffda/execute.ts"
      );
      const declaration = await compileUffdaSyntaxModule(parsed);
      return moduleDeclarationResult(declaration);
    } catch (err) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to lower syntax AST artifact at ${artifactPath} to a module declaration`,
        context,
        err,
      ));
    }
  }
}
