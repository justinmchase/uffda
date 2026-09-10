import type { ExportDeclaration } from "./export.ts";
import type { FuncDeclaration } from "./func.ts";
import type { ImportDeclaration } from "./import.ts";
import type { RuleDeclaration } from "./rule.ts";

export type ModuleDeclaration = {
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  rules: RuleDeclaration[];
  /** Author-defined callables; older artifacts MAY omit (treat as []). */
  funcs?: FuncDeclaration[];
};
