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
};

export type RuleExportDeclaration = {
  kind: ExportDeclarationKind.Rule;
  name: string;
};
