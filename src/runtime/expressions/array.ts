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
  // Evaluated sequentially (not `Promise.all`) — see invocation.ts for why
  // concurrent sibling-expression evaluation against a shared `match` is
  // unsafe (races the packrat left-recursion memo and `Input.next()`).
  const values: unknown[] = [];
  for (const expr of expressions) {
    values.push(await exec(expr.expression, match));
  }

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
