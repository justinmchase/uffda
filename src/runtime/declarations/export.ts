export type ExportDeclaration =
  | ImportExportDeclaration
  | RuleExportDeclaration
  | FuncExportDeclaration
  | DecoratorExportDeclaration;

export enum ExportDeclarationKind {
  Import = "import",
  Rule = "rule",
  Func = "func",
  Decorator = "decorator",
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

export type DecoratorExportDeclaration = {
  kind: ExportDeclarationKind.Decorator;
  name: string;
  default?: boolean;
};
