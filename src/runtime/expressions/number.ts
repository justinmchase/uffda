import type { NumberExpression } from "./expression.ts";

export function number(expression: NumberExpression): number {
  return expression.value;
}
