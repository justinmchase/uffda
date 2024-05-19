import { DeclarationKind } from "./declaration.kind.ts";
import { ModuleDeclaration } from "./module.ts";

export type ImportDeclaration = 
  | ModuleImportDeclaration
  | NativeImportDeclaration
  ;

export type ModuleImportDeclaration = {
  kind: DeclarationKind.ModuleImport;
  moduleUrl: string;
  names: string[];
};

export type NativeImportDeclaration = {
  kind: DeclarationKind.NativeImport;
  moduleUrl: string;
  names: string[];
  module: ModuleDeclaration | (() => ModuleDeclaration);
};
