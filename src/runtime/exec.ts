import { Match } from "../match.ts";
import {
  add,
  array,
  Expression,
  ExpressionKind,
  invocation,
  lambda,
  member,
  native,
  reference,
  special,
  subtract,
  value,
} from "./expressions/mod.ts";

export function exec(expression: Expression, match: Match): unknown {
  switch (expression.kind) {
    case ExpressionKind.Add:
      return add(expression, match);
    case ExpressionKind.Array:
      return array(expression, match);
    case ExpressionKind.Invocation:
      return invocation(expression, match);
    case ExpressionKind.Lambda:
      return lambda(expression, match);
    case ExpressionKind.Member:
      return member(expression, match);
    case ExpressionKind.Native:
      return native(expression, match);
    case ExpressionKind.Reference:
      return reference(expression, match);
    case ExpressionKind.SpecialReference:
      return special(expression, match);
    case ExpressionKind.Subtract:
      return subtract(expression, match);
    case ExpressionKind.Value:
      return value(expression);
    default:
      throw new Error(
        // deno-lint-ignore no-explicit-any
        `Cannot exec unknown expression kind ${(expression as any)?.kind}`,
      );
  }
}
