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
  pattern: unknown;
  projection?: unknown;
};

export type UffdaSyntaxDeclaration =
  | UffdaImportSyntaxDeclaration
  | UffdaExportSyntaxDeclaration
  | UffdaRuleSyntaxDeclaration;

export type UffdaSyntaxModule = {
  kind: "module";
  declarations: UffdaSyntaxDeclaration[];
};
