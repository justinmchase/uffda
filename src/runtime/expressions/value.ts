import type { ValueExpression } from "./expression.ts";

export function value(
  expression: ValueExpression,
): Promise<unknown> {
  return Promise.resolve(expression.value);
}
