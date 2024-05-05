import { IModuleDeclaration } from "../declarations/module.ts";
import { IModuleResolver } from "./resolver.ts";

export class JsonResolver implements IModuleResolver {
  public readonly extension = ".json";
  async resolveModule(moduleUrl: URL): Promise<IModuleDeclaration> {
    const module = await import(moduleUrl.href, { with: { type: "json" } })
    if (!module.default) {
      throw new Error(
        `Imported module ${moduleUrl} must export an IModuleDeclaration as a default export`,
      )
    }
    return module.default;
  }
}
