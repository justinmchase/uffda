import type { BooleanExpression } from "./expression.ts";

export function boolean(
  expression: BooleanExpression,
): Promise<boolean> {
  return Promise.resolve(expression.value);
}
