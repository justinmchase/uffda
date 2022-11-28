import { IModuleDeclaration } from "./module.ts";
import { ImportDeclaration } from "./import.ts";
import { IRuleDeclaration } from "./rule.ts";

export type Declaration =
  | IModuleDeclaration
  | ImportDeclaration
  | IRuleDeclaration
  ;