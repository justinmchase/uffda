import { Match } from "../../match.ts";
import { exec } from "../exec.ts";
import { IInvocationExpression } from "./expression.ts";

export function invocation(
  expression: IInvocationExpression,
  match: Match,
): unknown {
  const { expression: expr, arguments: args } = expression;
  const a = args.map((arg) => exec(arg, match));

  // deno-lint-ignore ban-types
  const fn = exec(expr, match) as Function;
  return fn(...a);
}
