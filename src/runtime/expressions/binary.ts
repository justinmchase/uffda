import { exec } from "../exec.ts";
import { BinaryOperation } from "./expression.ts";
import { type Awaitable, isThenable } from "./awaitable.ts";
import type { BinaryExpression } from "./expression.ts";
import type { MatchOk } from "../../match.ts";

export function binary(
  expression: BinaryExpression,
  match: MatchOk,
): Awaitable<unknown> {
  const { kind, left, right, op } = expression;
  const apply = (l: unknown, r: unknown) => {
    switch (op) {
      case BinaryOperation.And:
        return l && r;
      case BinaryOperation.Or:
        return l || r;
      default:
        throw new Error(`Unknown binary operation [${kind}:${op}]`);
    }
  };

  const l = exec(left, match);
  const r = exec(right, match);
  if (isThenable(l) || isThenable(r)) {
    return Promise.all([l, r]).then(([lv, rv]) => apply(lv, rv));
  }
  return apply(l, r);
}
