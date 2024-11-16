import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import type { MemberExpression } from "./expression.ts";

export function member(
  expression: MemberExpression,
  match: MatchOk,
): unknown {
  const { name, expression: expr } = expression;
  const result = exec(expr, match) as { [key: string]: unknown };
  return result[name];
}
