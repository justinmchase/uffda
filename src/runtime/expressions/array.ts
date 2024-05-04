import { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { IArrayExpression } from "./expression.ts";

export function array(
  expression: IArrayExpression,
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
