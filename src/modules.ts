import { Pattern } from "./runtime/patterns/mod.ts";

export enum ModuleKind {
  Module = "module",
  Rule = "rule",
  Import = "import",
}

export interface IImport {
  kind: ModuleKind.Import;
  name: string;
  module: IModule;
}

export interface IRule {
  kind: ModuleKind.Rule;
  module: IModule;
  name: string;
  pattern: Pattern;
}

export interface IModule {
  kind: ModuleKind.Module;
  moduleUrl: string;
  imports: Map<string, IImport>;
  rules: Map<string, IRule>;
}
