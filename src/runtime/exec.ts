import type { MatchSuccess } from "../match.ts";
import type { Awaitable } from "./awaitable.ts";
import type { Wrapped } from "../wrapped.ts";
import {
  array,
  boolean,
  type Expression,
  ExpressionKind,
  invocation,
  lambda,
  member,
  native,
  not,
  number,
  object,
  reference,
  string,
  value,
} from "./expressions/mod.ts";

export function exec(
  expression: Expression,
  match: MatchSuccess,
): Awaitable<Wrapped> {
  switch (expression.kind) {
    case ExpressionKind.Array:
      return array(expression, match);
    case ExpressionKind.Boolean:
      return boolean(expression, match);
    case ExpressionKind.Invocation:
      return invocation(expression, match);
    case ExpressionKind.Lambda:
      return lambda(expression, match);
    case ExpressionKind.Member:
      return member(expression, match);
    case ExpressionKind.Native:
      return native(expression, match);
    case ExpressionKind.Not:
      return not(expression, match);
    case ExpressionKind.Number:
      return number(expression, match);
    case ExpressionKind.Object:
      return object(expression, match);
    case ExpressionKind.Reference:
      return reference(expression, match);
    case ExpressionKind.String:
      return string(expression, match);
    case ExpressionKind.Value:
      return value(expression, match);
    default:
      throw new Error(
        // deno-lint-ignore no-explicit-any
        `Cannot exec unknown expression kind ${(expression as any)?.kind}`,
      );
  }
}
