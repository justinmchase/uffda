import type { Expression } from "../expressions/expression.ts";

export type FuncDeclaration = {
  name: string;
  parameters: FuncParameter[];
  expression: Expression;
};

export type FuncParameter = {
  name: string;
};
