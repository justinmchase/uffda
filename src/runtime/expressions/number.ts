import type { MatchSuccess } from "../../match.ts";
import { originOf, Wrapped } from "../../wrapped.ts";
import type { NumberExpression } from "./expression.ts";

export function number(
  expression: NumberExpression,
  match: MatchSuccess,
): Wrapped<number> {
  return new Wrapped(expression.value, originOf(match));
}
