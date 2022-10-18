import { IValueExpression } from "./expression.ts";

export function value(
  expression: IValueExpression,
): unknown {
  const { value } = expression;
  return value;
}
