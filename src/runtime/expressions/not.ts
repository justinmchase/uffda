import { exec, type MatchOk } from "../../mod.ts";
import type { NotExpression } from "./expression.ts";

export function not(
  expression: NotExpression,
  match: MatchOk,
) {
  const result = exec(expression.expression, match);
  return !result;
}
