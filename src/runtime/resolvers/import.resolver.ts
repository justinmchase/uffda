import type { ModuleDeclaration } from "../declarations/module.ts";
import type { IModuleResolver } from "./resolver.ts";

export class ImportResolver implements IModuleResolver {
  async resolveModule(moduleUrl: URL): Promise<ModuleDeclaration> {
    const module = await import(moduleUrl.href);
    if (!module.default) {
      throw new Error(
        `Imported module ${moduleUrl} must export an ModuleDeclaration as a default export`,
      );
    }
    return module.default;
  }
}
