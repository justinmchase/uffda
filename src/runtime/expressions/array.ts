import { Match } from "../../match.ts";
import { exec } from "../exec.ts";
import { IArrayExpression } from "./expression.ts";

export function array(
  expression: IArrayExpression,
  match: Match,
): unknown {
  const { expressions } = expression;
  return expressions.map((expr) => exec(expr, match));
}
