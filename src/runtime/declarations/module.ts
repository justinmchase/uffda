import type { ImportDeclaration } from "./import.ts";
import type { ExportDeclaration } from "./export.ts";
import type { RuleDeclaration } from "./rule.ts";

export type ModuleDeclaration = {
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  rules: RuleDeclaration[];
};
