import type { BooleanExpression } from "./expression.ts";

export async function boolean(
  expression: BooleanExpression,
): Promise<boolean> {
  const { value } = expression;
  return value;
}
