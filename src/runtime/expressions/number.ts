import { INumberExpression } from "./expression.ts";

export function number(
  expression: INumberExpression,
) {
  const { value } = expression;
  return value;
}
