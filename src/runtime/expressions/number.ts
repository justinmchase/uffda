import type { MatchOk } from "../../match.ts";
import { Wrapped } from "../../wrapped.ts";
import type { NumberExpression } from "./expression.ts";

export function number(
  expression: NumberExpression,
  match: MatchOk,
): Wrapped<number> {
  return new Wrapped(expression.value, match);
}
