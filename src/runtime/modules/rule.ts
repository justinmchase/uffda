import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";
import type { Attribute } from "./attribute.ts";
import type { Module } from "./module.ts";
import type { VariableScope } from "../variable_scope.ts";

export type Rule = {
  name: string;
  module: Module;
  pattern: Pattern;
  parameters: RuleParameter[];
  expression?: Expression;
  closureArgs?: Map<string, Rule>;
  /** Variables visible where an inline argument pattern was written. */
  closureVariables?: VariableScope;
  /** Applied attributes, in written order; set once during materialization. */
  attributes?: Attribute[];
  /** Metadata keyed by decorator name -> that decorator's raw return value. */
  metadata?: Record<string, unknown>;
};

export type RuleParameter = {
  name: string;
};

export function isRule(value: unknown): value is Rule {
  if (value === null || typeof value !== "object") return false;
  return "parameters" in value;
}
