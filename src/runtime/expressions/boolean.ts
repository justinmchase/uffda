import type { BooleanExpression } from "./expression.ts";

export function boolean(expression: BooleanExpression): boolean {
  return expression.value;
}
