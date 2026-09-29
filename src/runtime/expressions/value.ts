import type { MatchSuccess } from "../../match.ts";
import { originOf, Wrapped } from "../../wrapped.ts";
import type { ValueExpression } from "./expression.ts";

export function value(
  expression: ValueExpression,
  match: MatchSuccess,
): Wrapped {
  return new Wrapped(expression.value, originOf(match));
}
