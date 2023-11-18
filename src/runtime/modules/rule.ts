import { Pattern } from "../patterns/mod.ts";
import { Module } from "./module.ts";
import { ModuleKind } from "./moduleKind.ts";

export type Rule = {
  kind: ModuleKind.Rule;
  name: string;
  module: Module;
  pattern: Pattern;
};
