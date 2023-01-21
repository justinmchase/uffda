import { IStringExpression } from "./mod.ts";

export function string(
  expression: IStringExpression,
) {
  const { value } = expression;
  return value;
}
