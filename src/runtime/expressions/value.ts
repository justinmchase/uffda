import type { ValueExpression } from "./expression.ts";

export function value(expression: ValueExpression): unknown {
  return expression.value;
}
