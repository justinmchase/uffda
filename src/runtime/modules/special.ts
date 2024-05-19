import { Module } from "./module.ts";
import { Rule } from "./rule.ts";

export enum SpecialKind {
  Module = "module",
  Import = "import",
  Rule = "rule",
}

export type Special =
  | SpecialModule
  | SpecialRule
  | ((...args: unknown[]) => Special);

export type SpecialModule = {
  kind: SpecialKind.Module;
  module: Module;
};

export type SpecialRule = {
  kind: SpecialKind.Rule;
  rule: Rule;
};
