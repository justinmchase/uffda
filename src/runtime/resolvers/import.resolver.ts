import type { ModuleDeclaration } from "../declarations/module.ts";
import {
  type IModuleResolver,
  moduleDeclarationResolutionResult,
  type ModuleDeclarationResult,
  moduleDeclarationResult,
  ModuleDeclarationResultKind,
  type ModuleResolutionContext,
  moduleResolutionError,
} from "./resolver.ts";

export class ImportResolver implements IModuleResolver {
  async resolveModule(
    moduleUrl: URL,
    context: ModuleResolutionContext,
  ): Promise<ModuleDeclarationResult> {
    try {
      const module = await import(moduleUrl.href);
      if (!module.default) {
        return moduleDeclarationResolutionResult(moduleResolutionError(
          `Imported module ${moduleUrl} must export a ModuleDeclaration as a default export`,
          context,
        ));
      }
      return moduleDeclarationResult(module.default as ModuleDeclaration);
    } catch (err) {
      if (err && typeof err === "object" && "kind" in err) {
        const result = err as { kind?: unknown; error?: unknown };
        if (result.kind === ModuleDeclarationResultKind.Error) {
          return result as ModuleDeclarationResult;
        }
      }
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to import module declaration from ${moduleUrl}`,
        context,
        err,
      ));
    }
  }
}
