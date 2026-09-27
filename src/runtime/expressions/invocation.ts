import type { MatchOk } from "../../match.ts";
import { andThen, type Awaitable, mapInOrder } from "../awaitable.ts";
import { exec } from "../exec.ts";
import { collect } from "../collect.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { InvocationExpression } from "./expression.ts";

export function invocation(
  expression: InvocationExpression,
  match: MatchOk,
): Awaitable<unknown> {
  const { expression: expr, args } = expression;
  const invoke = (fn: unknown, a: unknown[]) => {
    if (typeof fn !== "function") {
      throw new Error(
        `Unable to invoke function [${fn}] for expression (${expr.kind}:${
          (expr as unknown as Record<string, unknown>)?.name
        })`,
      );
    }
    return fn(...a);
  };

  return andThen(exec(expr, match), (fn) =>
    // Evaluated sequentially (not `Promise.all`) so sibling argument
    // expressions never run concurrently against the same shared `match`
    // scope/stream. This is both simpler (a deterministic left-to-right
    // evaluation order) and required for correctness: concurrent evaluation
    // can race the packrat left-recursion memo and `Input.next()`, which are
    // only safe when driven by a single in-flight caller at a time.
    andThen(
      mapInOrder(args, (arg) =>
        exec(
          arg.kind === ExpressionKind.InvocationSpread ? arg.expression : arg,
          match,
        )),
      (values) =>
        andThen(
          mapInOrder(args, (arg, i): Awaitable<unknown[]> =>
            arg.kind === ExpressionKind.InvocationSpread
              // The value may be a lazily produced sequence (e.g. the result
              // of `enumerate`/`map`/`filter`), so drain it via `collect`
              // instead of relying on native `...` (which only supports sync
              // iterables).
              ? collect(values[i])
              : [values[i]]),
          (parts) => invoke(fn, parts.flat(1)),
        ),
    ));
}
