import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";
import type { AttributeDeclaration } from "./attribute.ts";

export type RuleDeclaration = {
  name: string;
  parameters: RuleParameter[];
  pattern: Pattern;
  expression?: Expression;
  /** Written left to right; older artifacts MAY omit (treat as []). */
  attributes?: AttributeDeclaration[];
};

export type RuleParameter = {
  name: string;
};
