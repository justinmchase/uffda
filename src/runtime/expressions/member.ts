import type { MatchOk } from "../../match.ts";
import { andThen, type Awaitable } from "../awaitable.ts";
import { exec } from "../exec.ts";
import type { MemberExpression } from "./expression.ts";
import { wrap, type Wrapped } from "../../wrapped.ts";

export function member(
  expression: MemberExpression,
  match: MatchOk,
): Awaitable<Wrapped> {
  const { name, expression: expr } = expression;
  return andThen(
    exec(expr, match),
    // A raw property of a host-supplied object takes the object's origin.
    (result) =>
      wrap((result.raw as { [key: string]: unknown })[name], result.origin),
  );
}
