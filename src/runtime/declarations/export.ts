export type ExportDeclaration =
  | ImportExportDeclaration
  | RuleExportDeclaration
  | FuncExportDeclaration;

export enum ExportDeclarationKind {
  Import = "import",
  Rule = "rule",
  Func = "func",
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

export type FuncExportDeclaration = {
  kind: ExportDeclarationKind.Func;
  name: string;
  default?: boolean;
};
