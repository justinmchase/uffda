import { DeclarationKind } from "./declaration.kind.ts";
import { ModuleDeclaration } from "./module.ts";

export interface IImportDeclaration {
  kind: DeclarationKind.Import;
  moduleUrl: string
  names: string[]
}

export interface INativeImportDeclaration {
  kind: DeclarationKind.NativeImport;
  moduleUrl: string;
  names: string[];
  module: ModuleDeclaration;
}

export type ImportDeclaration = IImportDeclaration | INativeImportDeclaration;
