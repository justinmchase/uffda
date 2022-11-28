import { Match } from "../../match.ts";
import { exec } from "../exec.ts";
import { RuntimeError, RuntimeErrorCode } from "../runtime.error.ts";
import { BinaryOperation, IBinaryExpression } from "./expression.ts";

export function binary(
  expression: IBinaryExpression,
  match: Match,
): unknown {
  const { kind, left, right, op } = expression;

  // deno-lint-ignore no-explicit-any
  const l = exec(left, match) as any;
  // deno-lint-ignore no-explicit-any
  const r = exec(right, match) as any;
  switch (op) {
    case BinaryOperation.Add:
      return l + r;
    case BinaryOperation.Subtract:
      return l - r;
    case BinaryOperation.Multiply:
      return l * r;
    case BinaryOperation.Divide:
      return l / r;
    case BinaryOperation.Mod:
      return l % r;
    default:
      throw new RuntimeError(
        RuntimeErrorCode.InvalidExpression,
        match.start.module,
        match.start.ruleStack[-1],
        expression,
        match,
        {
          metadata: {
            kind,
            op,
          },
        },
      );
  }
}
