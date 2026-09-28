import type { MatchOk } from "../../match.ts";
import { andThen, type Awaitable, mapInOrder } from "../awaitable.ts";
import { exec } from "../exec.ts";
import { collect } from "../collect.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type {
  InvocationArgument,
  InvocationExpression,
  InvocationSpreadExpression,
} from "./expression.ts";
import { wrap, type Wrapped } from "../../wrapped.ts";

const isSpread = (
  arg: InvocationArgument,
): arg is InvocationSpreadExpression =>
  arg.kind === ExpressionKind.InvocationSpread;

export function invocation(
  expression: InvocationExpression,
  match: MatchOk,
): Awaitable<Wrapped> {
  const { expression: expr, args } = expression;
  // A raw result was computed by this invocation, so `match` is its origin.
  const invoke = (callee: Wrapped, a: unknown[]) => {
    const fn = callee.raw;
    if (typeof fn !== "function") {
      throw new Error(
        `Unable to invoke function [${fn}] for expression (${expr.kind}:${
          (expr as unknown as Record<string, unknown>)?.name
        })`,
      );
    }
    return andThen(fn(...a), (result) => wrap(result, match));
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
          isSpread(arg) ? arg.expression : arg,
          match,
        )),
      (values) =>
        args.some(isSpread)
          ? andThen(expandSpreads(args, values), (a) => invoke(fn, a))
          : invoke(fn, values),
    ));
}

/** Argument values with each spread argument's sequence expanded in place. */
function expandSpreads(
  args: InvocationArgument[],
  values: unknown[],
): Awaitable<unknown[]> {
  return andThen(
    mapInOrder(args, (arg, i): Awaitable<unknown[]> =>
      isSpread(arg)
        // The value may be a lazily produced sequence (e.g. the result of
        // `enumerate`/`map`/`filter`), so drain it via `collect` instead of
        // relying on native `...` (which only supports sync iterables).
        ? collect(values[i])
        : [values[i]]),
    (parts) => parts.flat(1),
  );
}
