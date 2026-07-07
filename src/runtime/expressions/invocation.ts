import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
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
  const resolvedArgs = await Promise.all(args.map((arg) => exec(arg, match)));
  return invoke(fn, resolvedArgs);
}
