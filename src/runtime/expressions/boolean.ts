import type { MatchSuccess } from "../../match.ts";
import { originOf, Wrapped } from "../../wrapped.ts";
import type { BooleanExpression } from "./expression.ts";

export function boolean(
  expression: BooleanExpression,
  match: MatchSuccess,
): Wrapped<boolean> {
  return new Wrapped(expression.value, originOf(match));
}
