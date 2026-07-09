import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";
import type { Module } from "./module.ts";

export type Rule = {
  name: string;
  module: Module;
  pattern: Pattern;
  parameters: RuleParameter[];
  expression?: Expression;
  closureArgs?: Map<string, Rule>;
};

export type RuleParameter = {
  name: string;
};
