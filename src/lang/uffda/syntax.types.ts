import type { Expression } from "../../runtime/expressions/expression.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";

export type UffdaImportSyntaxDeclaration = {
  kind: "import";
  moduleUrl: string;
  names: string[];
};

export type UffdaExportSyntaxDeclaration = {
  kind: "export";
  name: string;
};

export type UffdaRuleSyntaxDeclaration = {
  kind: "rule";
  name: string;
  pattern: Pattern;
  projection?: Expression;
};

export type UffdaSyntaxDeclaration =
  | UffdaImportSyntaxDeclaration
  | UffdaExportSyntaxDeclaration
  | UffdaRuleSyntaxDeclaration;

export type UffdaSyntaxModule = {
  kind: "module";
  declarations: UffdaSyntaxDeclaration[];
};
