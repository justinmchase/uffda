import type { MatchOk } from "../../match.ts";
import { andThen, type Awaitable } from "../awaitable.ts";
import { exec } from "../exec.ts";
import type { NotExpression } from "./expression.ts";

export function not(
  expression: NotExpression,
  match: MatchOk,
): Awaitable<boolean> {
  return andThen(exec(expression.expression, match), (result) => !result);
}
