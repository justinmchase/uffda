import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { type Awaitable, isThenable } from "./awaitable.ts";
import type { MemberExpression } from "./expression.ts";

export function member(
  expression: MemberExpression,
  match: MatchOk,
): Awaitable<unknown> {
  const { name, expression: expr } = expression;
  const result = exec(expr, match);
  if (isThenable(result)) {
    return result.then((resolved) =>
      (resolved as { [key: string]: unknown })[name]
    );
  }
  return (result as { [key: string]: unknown })[name];
}
