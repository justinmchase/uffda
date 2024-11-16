import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";

export type RuleDeclaration = {
  name: string;
  parameters: RuleParameter[];
  pattern: Pattern;
  expression?: Expression;
};

export type RuleParameter = {
  name: string;
};
