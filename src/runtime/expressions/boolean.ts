import type { MatchOk } from "../../match.ts";
import { originOf, Wrapped } from "../../wrapped.ts";
import type { BooleanExpression } from "./expression.ts";

export function boolean(
  expression: BooleanExpression,
  match: MatchOk,
): Wrapped<boolean> {
  return new Wrapped(expression.value, originOf(match));
}
