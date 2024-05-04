import { NumberExpression } from "./expression.ts";

export function number(
  expression: NumberExpression,
) {
  const { value } = expression;
  return value;
}
