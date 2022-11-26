import { IModuleDeclaration } from "../declarations/module.ts";

export interface IModuleResolver {
  resolveModule: (modulePath: string) => Promise<IModuleDeclaration>;
}

export interface IModuleResolvers {
  [extension: string]: IModuleResolver
}
