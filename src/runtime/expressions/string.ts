import { StringExpression } from "./mod.ts";

export function string(
  expression: StringExpression,
) {
  const { value } = expression;
  return value;
}
