import type { NumberExpression } from "./expression.ts";

export async function number(
  expression: NumberExpression,
): Promise<number> {
  const { value } = expression;
  return value;
}
