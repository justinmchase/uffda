import { exec, type MatchOk } from "../../mod.ts";
import { type Awaitable, isThenable } from "./awaitable.ts";
import type { NotExpression } from "./expression.ts";

export function not(
  expression: NotExpression,
  match: MatchOk,
): Awaitable<boolean> {
  const result = exec(expression.expression, match);
  return isThenable(result)
    ? Promise.resolve(result).then((resolved) => !resolved)
    : !result;
}
