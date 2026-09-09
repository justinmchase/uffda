import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import type { NotExpression } from "./expression.ts";

export async function not(
  expression: NotExpression,
  match: MatchOk,
): Promise<boolean> {
  const result = await exec(expression.expression, match);
  return !result;
}
