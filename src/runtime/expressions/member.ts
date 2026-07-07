import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import type { MemberExpression } from "./expression.ts";

export async function member(
  expression: MemberExpression,
  match: MatchOk,
): Promise<unknown> {
  const { name, expression: expr } = expression;
  const result = await exec(expr, match);
  return (result as { [key: string]: unknown })[name];
}
