import { Match } from "../../match.ts";
import { exec } from "../exec.ts";
import { IAddExpression } from "./expression.ts";

export function add(
  expression: IAddExpression,
  match: Match,
): unknown {
  const { left, right } = expression;
  // deno-lint-ignore no-explicit-any
  const l = exec(left, match) as any;
  // deno-lint-ignore no-explicit-any
  const r = exec(right, match) as any;
  return l + r;
}
