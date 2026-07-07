import type { ValueExpression } from "./expression.ts";

export async function value(
  expression: ValueExpression,
): Promise<unknown> {
  const { value } = expression;
  return value;
}
