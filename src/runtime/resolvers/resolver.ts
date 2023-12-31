import { IModuleDeclaration } from "../declarations/module.ts";

export interface IModuleResolver {
  resolveModule: (moduleUrl: URL) => Promise<IModuleDeclaration>;
}

export interface IModuleResolvers {
  [extension: string]: IModuleResolver;
}
