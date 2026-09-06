import type { NumberExpression } from "./expression.ts";

export function number(
  expression: NumberExpression,
): Promise<number> {
  return Promise.resolve(expression.value);
}
