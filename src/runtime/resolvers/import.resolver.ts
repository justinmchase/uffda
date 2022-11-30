import { IModuleDeclaration } from "../declarations/module.ts";
import { IModuleResolver } from "./resolver.ts";

export class ImportResolver implements IModuleResolver {
  async resolveModule(moduleUrl: string): Promise<IModuleDeclaration> {
    const module = await import(moduleUrl);
    if (!module.default) {
      throw new Error(
        `Imported module ${moduleUrl} must export an IModuleDeclaration as a default export`,
      );
    }
    return module.default;
  }
}
