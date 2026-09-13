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

export type UffdaAttributeSyntax = {
  kind: "attribute";
  name: string;
  args: Expression[];
};

export type UffdaRuleSyntaxDeclaration = {
  kind: "rule";
  name: string;
  /** Formal parameters; empty when the declaration has no `<…>` list. */
  parameters: UffdaRuleParameterSyntax[];
  pattern: Pattern;
  projection?: Expression;
  /** Written left to right; empty when no `[Name]` prefix is present. */
  attributes: UffdaAttributeSyntax[];
};

export type UffdaFuncSyntaxDeclaration = {
  kind: "func";
  name: string;
  /** Args pattern (End when no parameter list); typically Then of captures. */
  pattern: Pattern;
  expression: Expression;
  /** Written left to right; empty when no `[Name]` prefix is present. */
  attributes: UffdaAttributeSyntax[];
};

export type UffdaDecoratorSyntaxDeclaration = {
  kind: "decorator";
  name: string;
  /** Args pattern (End when no parameter list); typically Then of captures. */
  pattern: Pattern;
  expression: Expression;
};

export type UffdaSyntaxDeclaration =
  | UffdaImportSyntaxDeclaration
  | UffdaExportSyntaxDeclaration
  | UffdaRuleSyntaxDeclaration
  | UffdaFuncSyntaxDeclaration
  | UffdaDecoratorSyntaxDeclaration;

export type UffdaSyntaxModule = {
  kind: "module";
  declarations: UffdaSyntaxDeclaration[];
};
