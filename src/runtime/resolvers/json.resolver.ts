import { ModuleDeclaration } from "../declarations/module.ts";
import { IModuleResolver } from "./resolver.ts";

export class JsonResolver implements IModuleResolver {
  public readonly extension = ".json";
  async resolveModule(moduleUrl: URL): Promise<ModuleDeclaration> {
    const module = await import(moduleUrl.href, { with: { type: "json" } });
    if (!module.default) {
      throw new Error(
        `Imported module ${moduleUrl} must export an ModuleDeclaration as a default export`,
      );
    }
    return module.default;
  }
}
