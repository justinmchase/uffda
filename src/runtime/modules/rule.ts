import { Expression } from "../expressions/expression.ts";
import { Pattern } from "../patterns/mod.ts";
import { Module } from "./module.ts";

export type Rule = {
  name: string;
  module: Module;
  pattern: Pattern;
  parameters: RuleParameter[];
  expression?: Expression;
};

export type RuleParameter = {
  name: string;
};
