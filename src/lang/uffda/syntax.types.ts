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

export type UffdaRuleParameterSyntax = {
  name: string;
};

export type UffdaRuleSyntaxDeclaration = {
  kind: "rule";
  name: string;
  /** Formal parameters; empty when the declaration has no `<…>` list. */
  parameters: UffdaRuleParameterSyntax[];
  pattern: Pattern;
  projection?: Expression;
};

export type UffdaFuncSyntaxDeclaration = {
  kind: "func";
  name: string;
  /** Args pattern (End when no parameter list); typically Then of captures. */
  pattern: Pattern;
  expression: Expression;
};

export type UffdaSyntaxDeclaration =
  | UffdaImportSyntaxDeclaration
  | UffdaExportSyntaxDeclaration
  | UffdaRuleSyntaxDeclaration
  | UffdaFuncSyntaxDeclaration;

export type UffdaSyntaxModule = {
  kind: "module";
  declarations: UffdaSyntaxDeclaration[];
};
