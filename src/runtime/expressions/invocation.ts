import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { collect } from "../collect.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { InvocationExpression } from "./expression.ts";

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
    return fn(...a);
  };

  const fn = await exec(expr, match);
  // Evaluated sequentially (not `Promise.all`) so sibling argument
  // expressions never run concurrently against the same shared `match`
  // scope/stream. This is both simpler (a deterministic left-to-right
  // evaluation order) and required for correctness: concurrent evaluation
  // can race the packrat left-recursion memo and `Input.next()`, which are
  // only safe when driven by a single in-flight caller at a time.
  const values: unknown[] = [];
  for (const arg of args) {
    values.push(
      await exec(
        arg.kind === ExpressionKind.InvocationSpread ? arg.expression : arg,
        match,
      ),
    );
  }

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
