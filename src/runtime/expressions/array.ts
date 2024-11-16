import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { MatchOk } from "../../match.ts";
import type { ArrayExpression } from "./expression.ts";

export function array(
  expression: ArrayExpression,
  match: MatchOk,
): unknown {
  const { expressions } = expression;
  return expressions.reduce<unknown[]>((arr, expr) => {
    const { kind } = expr;
    switch (kind) {
      case ExpressionKind.ArrayElement:
        return [...arr, exec(expr.expression, match)];
      case ExpressionKind.ArraySpread:
        return [...arr, ...exec(expr.expression, match) as []];
      default:
        throw new Error(`Unexpected array initializer ${kind}`);
    }
  }, []);
}
