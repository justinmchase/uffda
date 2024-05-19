import { ModuleDeclaration } from "./module.ts";
import { ImportDeclaration } from "./import.ts";
import { RuleDeclaration } from "./rule.ts";

export type Declaration =
  | ModuleDeclaration
  | ImportDeclaration
  | RuleDeclaration;
