import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
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
  const values = await Promise.all(
    args.map((arg) =>
      exec(
        arg.kind === ExpressionKind.InvocationSpread ? arg.expression : arg,
        match,
      )
    ),
  );

  const resolvedArgs = args.reduce<unknown[]>((all, arg, i) => {
    const value = values[i];
    if (arg.kind === ExpressionKind.InvocationSpread) {
      return [...all, ...(value as [])];
    }
    return [...all, value];
  }, []);

  return invoke(fn, resolvedArgs);
}
