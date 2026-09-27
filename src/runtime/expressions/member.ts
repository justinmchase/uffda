import type { MatchOk } from "../../match.ts";
import { andThen, type Awaitable } from "../awaitable.ts";
import { exec } from "../exec.ts";
import type { MemberExpression } from "./expression.ts";

export function member(
  expression: MemberExpression,
  match: MatchOk,
): Awaitable<unknown> {
  const { name, expression: expr } = expression;
  return andThen(
    exec(expr, match),
    (result) => (result as { [key: string]: unknown })[name],
  );
}
