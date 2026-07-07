import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { MatchOk } from "../../match.ts";
import type { ArrayExpression } from "./expression.ts";

export async function array(
  expression: ArrayExpression,
  match: MatchOk,
): Promise<unknown> {
  const { expressions } = expression;
  const values = await Promise.all(
    expressions.map((expr) => exec(expr.expression, match)),
  );
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

  return reduceValues(values);
}
