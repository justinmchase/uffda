export type ExportDeclaration =
  | ImportExportDeclaration
  | RuleExportDeclaration;

export enum ExportDeclarationKind {
  Import = "import",
  Rule = "rule",
}

export type ImportExportDeclaration = {
  kind: ExportDeclarationKind.Import;
  name: string;
  default?: boolean;
};

export type RuleExportDeclaration = {
  kind: ExportDeclarationKind.Rule;
  name: string;
  default?: boolean;
};
