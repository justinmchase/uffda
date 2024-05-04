import { MatchOk } from "../match.ts";
import {
  array,
  binary,
  boolean,
  Expression,
  ExpressionKind,
  invocation,
  lambda,
  member,
  native,
  number,
  object,
  reference,
  special,
  string,
  value,
} from "./expressions/mod.ts";

export function exec(expression: Expression, match: MatchOk): unknown {
  switch (expression.kind) {
    case ExpressionKind.Array:
      return array(expression, match);
    case ExpressionKind.Binary:
      return binary(expression, match);
    case ExpressionKind.Boolean:
      return boolean(expression);
    case ExpressionKind.Invocation:
      return invocation(expression, match);
    case ExpressionKind.Lambda:
      return lambda(expression, match);
    case ExpressionKind.Member:
      return member(expression, match);
    case ExpressionKind.Native:
      return native(expression, match);
    case ExpressionKind.Number:
      return number(expression);
    case ExpressionKind.Object:
      return object(expression, match);
    case ExpressionKind.Reference:
      return reference(expression, match);
    case ExpressionKind.Special:
      return special(expression, match);
    case ExpressionKind.String:
      return string(expression);
    case ExpressionKind.Undefined:
      return undefined;
    case ExpressionKind.Value:
      return value(expression);
    default:
      throw new Error(
        // deno-lint-ignore no-explicit-any
        `Cannot exec unknown expression kind ${(expression as any)?.kind}`,
      );
  }
}
