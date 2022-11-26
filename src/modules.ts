import { Pattern } from "./runtime/patterns/mod.ts";

export interface IImport {
  name: string;
  module: IModule;
}

export interface IRule {
  module: IModule;
  name: string;
  pattern: Pattern;
}

export interface IModule {
  moduleUrl: string
  imports: Map<string, IImport>;
  rules: Map<string, IRule>;
}