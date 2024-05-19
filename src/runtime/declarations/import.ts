import { ModuleDeclaration } from "./module.ts";

export type ImportDeclaration =
  | ModuleImportDeclaration
  | NativeImportDeclaration;

export enum ImportDeclarationKind {
  Module = "module",
  Native = "native",
}

export type ModuleImportDeclaration = {
  kind: ImportDeclarationKind.Module;
  moduleUrl: string;
  names: string[];
};

export type NativeImportDeclaration = {
  kind: ImportDeclarationKind.Native;
  moduleUrl: string;
  names: string[];
  module: ModuleDeclaration | (() => ModuleDeclaration);
};
