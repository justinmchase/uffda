import { DeclarationKind } from "./declaration.kind.ts";
import { ImportDeclaration } from "./import.ts";
import { IRuleDeclaration } from "./rule.ts";

export interface IModuleDeclaration {
  kind: DeclarationKind.Module;
  imports: ImportDeclaration[];
  rules: IRuleDeclaration[];
}

export type ModuleDeclaration =
  | IModuleDeclaration
  | (() => IModuleDeclaration);
