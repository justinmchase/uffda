import { andThen, type Awaitable, mapInOrder } from "../awaitable.ts";
import { exec } from "../exec.ts";
import { collect } from "../collect.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { MatchOk } from "../../match.ts";
import type { ArrayExpression } from "./expression.ts";

export function array(
  expression: ArrayExpression,
  match: MatchOk,
): Awaitable<unknown> {
  const { expressions } = expression;
  // Evaluated sequentially (not `Promise.all`) — see invocation.ts for why
  // concurrent sibling-expression evaluation against a shared `match` is
  // unsafe (races the packrat left-recursion memo and `Input.next()`).
  return andThen(
    mapInOrder(expressions, (expr) => exec(expr.expression, match)),
    (values) =>
      andThen(
        mapInOrder(expressions, (expr, i): Awaitable<unknown[]> => {
          switch (expr.kind) {
            case ExpressionKind.ArrayElement:
              return [values[i]];
            case ExpressionKind.ArraySpread:
              // The value may be a lazily produced sequence (e.g. the result
              // of `enumerate`/`map`/`filter`), so drain it via `collect`
              // instead of relying on native `...` (which only supports sync
              // iterables).
              return collect(values[i]);
            default:
              throw new Error("Unexpected array initializer");
          }
        }),
        (parts) => parts.flat(1),
      ),
  );
}
