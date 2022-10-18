import { Match } from "../match.ts";
import {
  add,
  array,
  Expression,
  ExpressionKind,
  native,
  reference,
  special,
  subtract,
} from "./expressions/mod.ts";

export function exec(expression: Expression, match: Match): unknown {
  switch (expression.kind) {
    case ExpressionKind.Add:
      return add(expression, match);
    case ExpressionKind.Array:
      return array(expression, match);
    case ExpressionKind.Native:
      return native(expression, match);
    case ExpressionKind.Reference:
      return reference(expression, match);
    case ExpressionKind.SpecialReference:
      return special(expression, match);
    case ExpressionKind.Subtract:
      return subtract(expression, match);
    default:
      throw new Error(
        // deno-lint-ignore no-explicit-any
        `Cannot exec unknown expression kind ${(expression as any)?.kind}`,
      );
  }
}
