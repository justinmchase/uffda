import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { allOrSync, type Awaitable, isThenable } from "./awaitable.ts";
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

  const fn = exec(expr, match);
  const a = args.map((arg) => exec(arg, match));
  const resolvedArgs = allOrSync(a);
  if (isThenable(fn) || isThenable(resolvedArgs)) {
    return Promise.all([fn, resolvedArgs]).then(([f, resolved]) =>
      invoke(f, resolved)
    );
  }
  return invoke(fn, resolvedArgs);
}
