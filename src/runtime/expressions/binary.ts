import { exec } from "../exec.ts";
import { BinaryOperation } from "./expression.ts";
import type { BinaryExpression } from "./expression.ts";
import type { MatchOk } from "../../match.ts";

export function binary(
  expression: BinaryExpression,
  match: MatchOk,
): unknown {
  const { kind, left, right, op } = expression;
  const l = exec(left, match);
  const r = exec(right, match);
  switch (op) {
    case BinaryOperation.And:
      return l && r;
    case BinaryOperation.Or:
      return l || r;
    default:
      throw new Error(
        `Unknown binary operation [${kind}:${op}]`,
      );
  }
}
