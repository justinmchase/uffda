import { IModuleDeclaration } from "../declarations/module.ts";
import { IModuleResolver } from "./resolver.ts";

export class ImportResolver implements IModuleResolver {
  async resolveModule(modulePath: string): Promise<IModuleDeclaration> {
    const module = await import(modulePath)
    return module.default
  }
}
