import { IBooleanExpression } from "./expression.ts";

export function boolean(
  expression: IBooleanExpression,
) {
  const { value } = expression;
  return value;
}
