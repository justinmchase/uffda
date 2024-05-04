import { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { IInvocationExpression } from "./expression.ts";

export function invocation(
  expression: IInvocationExpression,
  match: MatchOk,
): unknown {
  const { expression: expr, args } = expression;
  const a = args.map((arg) => exec(arg, match));
  const fn = exec(expr, match);
  if (typeof fn !== "function") {
    throw new Error(
      `Unable to invoke function [${fn}] for expression (${expr.kind}:${
        (expr as unknown as Record<
          string,
          unknown
        >)?.name
      })`,
    );
  }
  return fn(...a);
}
