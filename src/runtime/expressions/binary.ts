import { exec } from "../exec.ts";
import { BinaryOperation } from "./expression.ts";
import type { BinaryExpression } from "./expression.ts";
import type { MatchOk } from "../../match.ts";

export async function binary(
  expression: BinaryExpression,
  match: MatchOk,
): Promise<unknown> {
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

  const [l, r] = await Promise.all([exec(left, match), exec(right, match)]);
  return apply(l, r);
}
