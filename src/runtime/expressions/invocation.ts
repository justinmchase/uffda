import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { collect } from "../collect.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { InvocationExpression } from "./expression.ts";
import { isMatchAware } from "../globals/match_aware.ts";

export async function invocation(
  expression: InvocationExpression,
  match: MatchOk,
): Promise<unknown> {
  const { expression: expr, args } = expression;
  const invoke = (fn: unknown, a: unknown[]) => {
    if (typeof fn !== "function") {
      throw new Error(
        `Unable to invoke function [${fn}] for expression (${expr.kind}:${
          (expr as unknown as Record<string, unknown>)?.name
        })`,
      );
    }
    if (isMatchAware(fn)) {
      return fn(match, ...a);
    }
    return fn(...a);
  };

  const fn = await exec(expr, match);
  const values = await Promise.all(
    args.map((arg) =>
      exec(
        arg.kind === ExpressionKind.InvocationSpread ? arg.expression : arg,
        match,
      )
    ),
  );

  const resolvedArgs: unknown[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = values[i];
    if (arg.kind === ExpressionKind.InvocationSpread) {
      // `value` may be a lazily produced sequence (e.g. the result of
      // `enumerate`/`map`/`filter`), so drain it via `collect` instead of
      // relying on native `...` (which only supports sync iterables).
      resolvedArgs.push(...await collect(value));
    } else {
      resolvedArgs.push(value);
    }
  }

  return invoke(fn, resolvedArgs);
}
