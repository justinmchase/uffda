import { exec } from "../exec.ts";
import { allOrSync, type Awaitable, isThenable } from "./awaitable.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { MatchOk } from "../../match.ts";
import type { ArrayExpression } from "./expression.ts";

export function array(
  expression: ArrayExpression,
  match: MatchOk,
): Awaitable<unknown> {
  const { expressions } = expression;
  const values = expressions.map((expr) => exec(expr.expression, match));
  const reduceValues = (resolved: unknown[]) =>
    expressions.reduce<unknown[]>((arr, expr, i) => {
      const value = resolved[i];
      switch (expr.kind) {
        case ExpressionKind.ArrayElement:
          return [...arr, value];
        case ExpressionKind.ArraySpread:
          return [...arr, ...value as []];
        default:
          throw new Error("Unexpected array initializer");
      }
    }, []);

  const resolvedValues = allOrSync(values);
  return isThenable(resolvedValues)
    ? resolvedValues.then(reduceValues)
    : reduceValues(resolvedValues);
}
