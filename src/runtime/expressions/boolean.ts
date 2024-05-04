import { BooleanExpression } from "./expression.ts";

export function boolean(
  expression: BooleanExpression,
) {
  const { value } = expression;
  return value;
}
