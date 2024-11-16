import type { ModuleDeclaration } from "../declarations/module.ts";

export interface IModuleResolver {
  resolveModule: (moduleUrl: URL) => Promise<ModuleDeclaration>;
}

export interface IModuleResolvers {
  [extension: string]: IModuleResolver;
}
