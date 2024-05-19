import { DeclarationKind } from "./declaration.kind.ts";
import { ImportDeclaration } from "./import.ts";
import { RuleDeclaration } from "./rule.ts";

export type ModuleDeclaration = {
  kind: DeclarationKind.Module;
  imports: ImportDeclaration[];
  rules: RuleDeclaration[];
}

// export type ModuleDeclaration =
//   | IModuleDeclaration
//   | (() => IModuleDeclaration);
