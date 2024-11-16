import type { ValueExpression } from "./expression.ts";

export function value(
  expression: ValueExpression,
): unknown {
  const { value } = expression;
  return value;
}
