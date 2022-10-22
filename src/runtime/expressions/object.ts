import { Match } from "../../match.ts";
import { exec } from "../exec.ts";
import { IObjectExpression } from "./expression.ts";

export function object(
  expression: IObjectExpression,
  match: Match,
): unknown {
  const { keys } = expression;
  return keys
    .map<[string, unknown]>((
      { name, expression },
    ) => [name, exec(expression, match)])
    .reduce<Record<string, unknown>>(
      (obj, [name, value]) => Object.assign(obj, { [name]: value }),
      {},
    );
}
