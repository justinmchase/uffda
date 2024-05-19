import { Pattern } from "../patterns/mod.ts";
import { Module } from "./module.ts";

export type Rule = {
  name: string;
  module: Module;
  pattern: Pattern;
  parameters: RuleParameter[];
};

export type RuleParameter = {
  name: string;
};
