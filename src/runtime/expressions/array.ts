import { exec } from "../exec.ts";
import { collect } from "../collect.ts";
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

  const result: unknown[] = [];
  for (let i = 0; i < expressions.length; i++) {
    const expr = expressions[i];
    const value = values[i];
    switch (expr.kind) {
      case ExpressionKind.ArrayElement:
        result.push(value);
        break;
      case ExpressionKind.ArraySpread:
        // `value` may be a lazily produced sequence (e.g. the result of
        // `enumerate`/`map`/`filter`), so drain it via `collect` instead of
        // relying on native `...` (which only supports sync iterables).
        result.push(...await collect(value));
        break;
      default:
        throw new Error("Unexpected array initializer");
    }
  }

  return result;
}
