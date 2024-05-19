import { ImportDeclaration } from "./import.ts";
import { ExportDeclaration } from "./export.ts";
import { RuleDeclaration } from "./rule.ts";

export type ModuleDeclaration = {
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  rules: RuleDeclaration[];
};
