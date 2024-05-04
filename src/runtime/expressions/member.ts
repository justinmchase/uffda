import { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { IMemberExpression } from "./expression.ts";

export function member(
  expression: IMemberExpression,
  match: MatchOk,
): unknown {
  const { name, expression: expr } = expression;
  const result = exec(expr, match) as { [key: string]: unknown };
  return result[name];
}
