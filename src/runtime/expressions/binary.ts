import { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { BinaryExpression, BinaryOperation } from "./expression.ts";

export function binary(
  expression: BinaryExpression,
  match: MatchOk,
): unknown {
  const { kind, left, right, op } = expression;
  const l = exec(left, match);
  const r = exec(right, match);

  if (typeof l !== "number") {
    throw new Error(
      `Binary operation requires left operand to be a number, but got [${l}:${typeof l}]`,
    );
  }
  if (typeof r !== "number") {
    throw new Error(
      `Binary operation requires right operand to be a number, but got [${r}:${typeof r}]`,
    );
  }
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
      throw new Error(
        `Unknown binary operation [${kind}:${op}]`,
      );
  }
}
